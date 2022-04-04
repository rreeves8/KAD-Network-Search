import net, { Socket } from "net"
import { DHTADT, Peer, Self, JoinPacket, SearchPacket, K_bucket } from "./types";
import singleton from "./Singleton"
import os from "os"
import { dissectImagePacket, dissectJoinPacket, dissectSearchPacket, getImagePacket, getJoinPacket, getSearchPacket } from "./kadPTPmessage";
import { pushBucket, updateDHTtable, sendHello } from "./Bucket";
import fs from "fs"
import open from "open"

singleton.init();

let portOBJ = {
    "peer1": 2001,
    "peer2": 2055,
    "peer3": 2077,
    "peer4": 2044,
    "peer5": 2005,
}

let imageName = {
    "peer1": "Canna.gif",
    "peer2": "Flicker.jpeg",
    "peer3": "CherryBlossom.gif",
    "peer4": "Parrot.jpeg",
    "peer5": "Cardinal.jpeg",
}

// get current folder name
let path = __dirname.split("\\");
let myName = path[path.length - 1];
let ifaces = os.networkInterfaces();
let HOST = "";
let PORT = portOBJ[myName];
let serverImageName = imageName[myName]

// get the loaclhost ip address

Object.keys(ifaces).forEach(function (ifname) {
    ifaces[ifname].forEach(function (iface) {
        if ("IPv4" == iface.family && iface.internal !== false) {
            HOST = iface.address;
        }
    });
});

let serverID = singleton.getPeerID(HOST, PORT);

let serverPeer: Self;
let serverDHT: DHTADT;

const main = async () => {
    try {
        if (process.argv.length > 2) {
            await connectToNetwork()

            console.log("Joined Network \n")

            if (process.argv[5]) {
                let imageName = process.argv[5]

                console.log("Searching the network for image: " + imageName + "\n")

                imageServer(imageName)

                let imageComp = imageName.split('.')

                search({
                    version: 7,
                    messageType: 3,
                    senderName: serverPeer.peerName,
                    originatingIP: serverPeer.peerIP,
                    originatingImagePort: serverPeer.peerImagePort,
                    imageType: imageComp[1],
                    imageName: imageComp[0]
                }, null)
            }

        } else {
            serverPeer = {
                peerName: myName,
                peerIP: HOST,
                peerPort: PORT,
                peerID: serverID,
                peerImagePort: singleton.getPort(),
                keyID: singleton.getKeyID(imageName[myName]),
            };

            serverDHT = {
                owner: serverPeer,
                table: []
            }

            runServer(serverPeer.peerName, serverPeer.peerIP, serverPeer.peerPort, serverDHT)
        }
    }
    catch (e) {
        throw e
    }
}

const search = (searchPacket: SearchPacket, resolve: any) => {
    let clientSocket = new net.Socket()
    let closestPeer: Peer = serverDHT.table[0].peer

    try {
        clientSocket.connect({ port: closestPeer.peerPort, host: closestPeer.peerIP }, () => {
            clientSocket.write(getSearchPacket(searchPacket))
            clientSocket.end()
            if (resolve) {
                resolve(null)
            }
        })
    }
    catch(e) {
        console.log(e)
        if (resolve) {
            resolve(null)
        }
    }
}

const imageServer = (imageName: string) => {
    console.log("Creating Image server \n")
    let serverSocket = net.createServer();
    let imageSocket = serverPeer.peerImagePort
    let imageID = serverPeer.keyID

    serverSocket.listen(imageSocket, HOST)

    serverSocket.on("connection", (socket) => {
        socket.on("data", (data) => {
            let imagePacket = dissectImagePacket(data)

            console.log("Got image Packet \n" + 
                "Version: " + imagePacket.version + "\n" +
                "sequenceNumber: " + imagePacket.sequenceNumber + "\n" +
                "timeStamp: " + imagePacket.timeStamp + "\n" +
                "Version: " + imagePacket.version + "\n" 
            )

            fs.writeFileSync(imageName, imagePacket.imageData);

            open(__dirname + "\\" + imageName, { wait: true })

        })
    })
}

const connectToNetwork = (): Promise<null> => {
    return new Promise(resolve => {
        let clientSocket = new net.Socket();
        let firstFlag = process.argv[2]; // should be -p
        let hostserverIPandPort = process.argv[3].split(":");
        let knownHOST = hostserverIPandPort[0];
        let knownPORT = hostserverIPandPort[1];

        //@ts-ignore
        clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: PORT }, async () => {
            // initialize client DHT table
            let clientID = singleton.getPeerID(clientSocket.localAddress, PORT)

            serverPeer = {
                peerName: myName, // client name
                peerIP: clientSocket.localAddress,
                peerPort: PORT,
                peerID: clientID,
                keyID: singleton.getKeyID(imageName[myName]),
                peerImagePort: singleton.getPort()
            };

            serverDHT = {
                owner: serverPeer,
                table: []
            }

            await ((): Promise<null> => {
                return new Promise(resolve => {
                    let senderPeerID = singleton.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort)

                    clientSocket.on('data', (message: Buffer) => {
                        let kadPacket: JoinPacket = dissectJoinPacket(message);

                        let senderPeerName = kadPacket.senderName;
                        let senderPeer: Peer = {
                            peerName: senderPeerName,
                            peerIP: clientSocket.remoteAddress,
                            peerPort: clientSocket.remotePort,
                            peerID: senderPeerID
                        };

                        if (kadPacket.messageType == 1) {
                            // This message comes from the server
                            console.log(
                                "Connected to " +
                                senderPeerName +
                                ":" +
                                clientSocket.remotePort +
                                " at timestamp: " +
                                singleton.getTimestamp() + "\n"
                            );

                            runServer(myName, clientSocket.localAddress, clientSocket.localPort, serverDHT)

                            console.log("Received Welcome message from " + senderPeerName) + "\n";
                            if (kadPacket.peerList.length > 0) {
                                let output = "  along with DHT: ";
                                for (var i = 0; i < kadPacket.peerList.length; i++) {
                                    output +=
                                        "[" +
                                        kadPacket.peerList[i].peerIP + ":" +
                                        kadPacket.peerList[i].peerPort + ", " +
                                        kadPacket.peerList[i].peerID +
                                        "]\n                  ";
                                }
                                console.log(output);
                            } else {
                                console.log("  along with DHT: []\n");
                            }

                            // add the bootstrap node into the DHT table but only if it is not exist already
                            let exist = serverDHT.table.find(e => e.peer.peerPort == clientSocket.remotePort);
                            if (!exist) {
                                pushBucket(serverDHT, senderPeer);
                            } else {
                                console.log(senderPeer.peerPort + " is exist already")
                            }

                            updateDHTtable(serverDHT, kadPacket.peerList)

                        } else {
                            // Later we will consider other message types.
                            console.log("The message type " + kadPacket.messageType + " is not supported")
                        }
                    });

                    clientSocket.on("end", async () => {
                        // disconnected from server
                        await sendHello(serverDHT)
                        resolve(null)
                        clientSocket.destroy()
                    })
                })
            })()

            resolve(null)
        });
    })
}

const runServer = (clientName: string, localAddress: string, localPort: number, DHTtable: DHTADT) => {
    let myReceivingPort = null;
    let mySendingPort = null;
    // Now run as a server
    myReceivingPort = localPort;
    let localPeerID = singleton.getPeerID(localAddress, myReceivingPort);

    let serverPeer = net.createServer();
    serverPeer.listen(myReceivingPort, localAddress);
    console.log(
        "This peer address is " +
        localAddress +
        ":" +
        myReceivingPort +
        " located at " +
        clientName +
        " [" + localPeerID + "]\n"
    );

    // Wait for other peers to connect
    serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock, DHTtable);
    });
}

function handleClient(sock: Socket, serverDHTtable: DHTADT) {
    let kadPacket = null
    let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;
    let rawData: Buffer = null

    // initialize client DHT table
    let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort)
    let joiningPeer: Peer = {
        peerName: "",
        peerIP: sock.remoteAddress,
        peerPort: sock.remotePort,
        peerID: joiningPeerID
    };

    // Triggered only when the client is sending kadPTP message
    sock.on('data', (message: Buffer) => {
        rawData = message
        kadPacket = dissectJoinPacket(message);
    });

    sock.on('end', async () => {
        // client edded the connection
        if (kadPacket) {
            // Here, the msgType cannot be 1. It can be 2 or greater
            if (kadPacket.messageType === 2) {
                console.log("Received Hello Message from " + kadPacket.senderName);

                if (kadPacket.peerList.length > 0) {
                    let output = "  along with DHT: ";
                    // now we can assign the peer name
                    joiningPeer.peerName = kadPacket.senderName;
                    for (var i = 0; i < kadPacket.peerList.length; i++) {
                        output +=
                            "[" +
                            kadPacket.peerList[i].peerIP + ":" +
                            kadPacket.peerList[i].peerPort + ", " +
                            kadPacket.peerList[i].peerID +
                            "]\n                  ";
                    }
                    console.log(output);
                }

                // add the sender into the table only if it is not exist or set the name of the exisiting one
                let exist = serverDHTtable.table.find(e => e.peer.peerPort == joiningPeer.peerPort);
                if (exist) {
                    exist.peer.peerName = joiningPeer.peerName;
                } else {
                    pushBucket(serverDHTtable, joiningPeer);
                }

                // Now update the DHT table
                updateDHTtable(serverDHTtable, kadPacket.peerList);
            }
            if (kadPacket.messageType === 3) {
                let searchPacket = dissectSearchPacket(rawData)
                console.log("Received Search Message from " + searchPacket.senderName + "\n");
                console.log(
                    "Version: " + searchPacket.version + "\n" +
                    "TimeStamp: " + singleton.getTimestamp() + "\n" +
                    "Request Type: " + "Query" + "\n" +
                    "Image Name:" + searchPacket.imageName + "." + searchPacket.imageType + "\n"
                )

                await new Promise(resolve => setTimeout(resolve, 500));

                await ((): Promise<null> => {
                    return new Promise(resolve => {
                        if (singleton.getKeyID(searchPacket.imageName + "." + serverImageName.split(".")[1]) === serverPeer.keyID) {
                            console.log("The requested Image Was found, sending image \n")
                            let imageSocket = new net.Socket()

                            let imgData = fs.readFileSync(__dirname + "\\" + serverImageName)

                            imageSocket.connect({ port: searchPacket.originatingImagePort, host: searchPacket.originatingIP }, () => {
                                imageSocket.write(getImagePacket({
                                    version: 7,
                                    messageType: 4,
                                    sequenceNumber: singleton.getSequenceNumber(),
                                    timeStamp: singleton.getTimestamp(),
                                    imageSize: imgData.length,
                                    imageData: imgData
                                }))
                                imageSocket.end()
                                resolve(null)
                            })
                        }
                        else {
                            console.log("The requested Image Was not found, sending request to closest peer \n")
                            sock.end()
                            sock.destroy()
                            new Promise(resolve => setTimeout(resolve, 500)).then(() => {
                                search(searchPacket, resolve)
                            })
                        }
                    })
                })()
            }
        } else {
            // This was a bootstrap request
            console.log("Connected from peer " + joiningPeerAddress + "\n");
            // add the requester info into server DHT table
            pushBucket(serverDHTtable, joiningPeer);
        }
    });

    if (kadPacket == null) {
        // This is a bootstrap request
        // send acknowledgment to the client
        let packet = getJoinPacket({
            version: 7,
            messageType: 1,
            peerList: serverDHTtable.table.map((e) => {
                return e.peer
            }),
            numberOfPeers: serverDHTtable.table.length,
            senderName: serverDHTtable.owner.peerName
        });

        sock.write(packet);
        sock.end();
    }
}

main()