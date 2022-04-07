import net, { Socket } from "net"
import { DHTADT, Peer, Self, JoinPacket, SearchPacket, K_bucket } from "./types";
import singleton from "./Singleton"
import os from "os"
import { dissectImagePacket, dissectJoinPacket, dissectSearchPacket, getImagePacket, getJoinPacket, getSearchPacket } from "./KADpackets";
import { pushBucket, updateDHTtable, sendHello, getClosest } from "./Bucket";
import fs from "fs"
import open from "open"

singleton.init();

interface PortADT {
    [key: string]: number
}

interface ImageADT {
    [key: string]: string
}

let portOBJ: PortADT = {
    "peer1": 2001,
    "peer2": 2055,
    "peer3": 2077,
    "peer4": 2044,
    "peer5": 2005,
}

let imageName: ImageADT = {
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
    //@ts-ignore
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
        //load this if args provided
        if (process.argv.length > 2) {
            //run connect to network function and wait for completion till next step
            await connectToNetwork()

            console.log("Joined Network \n")
            //if an image is provided in the args
            if (process.argv[5]) {
                let imageName = process.argv[5]

                console.log("Searching the network for image: " + imageName + "\n")
                //start the image server 
                imageServer(imageName)

                let imageComp = imageName.split('.')

                //run the search function and look for the image, the search function just sends the packet to the cosest peer
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

        } 
        //load this if no args provided
        else {
            //assign server peer values
            serverPeer = {
                peerName: myName,
                peerIP: HOST,
                peerPort: PORT,
                peerID: serverID,
                peerImagePort: singleton.getPort(),
                keyID: singleton.getKeyID(imageName[myName]),
            };

            //assign dht table
            serverDHT = {
                owner: serverPeer,
                table: []
            }

            //run server
            runServer(serverPeer.peerName, serverPeer.peerIP, serverPeer.peerPort, serverDHT)
        }
    }
    catch (e) {
        throw e
    }
}

//this function sends the search packet to the next closest peer, resolve if a promise is used for awaiting
const search = (searchPacket: SearchPacket, resolve: any) => {
    let clientSocket = new net.Socket()
    let closestPeer: Peer = getClosest(serverDHT)

    try {
        clientSocket.connect({ port: closestPeer.peerPort, host: closestPeer.peerIP }, () => {
            clientSocket.write(getSearchPacket(searchPacket))
            clientSocket.end()
            if (resolve) {
                resolve(null)
            }
        })
    }
    catch (e) {
        console.log(e)
        if (resolve) {
            resolve(null)
        }
    }
}

//if the args have an image provided, run this server to wait for a peer to send it over
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
                "timeStamp: " + imagePacket.timeStamp + "\n" 
            )

            fs.writeFileSync(imageName, imagePacket.imageData);

            open(__dirname + "\\" + imageName, { wait: true })

        })
    })
}

//this fires if the command line has provided a peer to connect to
const connectToNetwork = (): Promise<null> => {
    return new Promise(resolve => {
        let clientSocket = new net.Socket();
        //get provided server connection
        let firstFlag = process.argv[2]; // should be -p
        let hostserverIPandPort = process.argv[3].split(":");
        let knownHOST = hostserverIPandPort[0];
        let knownPORT = hostserverIPandPort[1];

        //connect
        //@ts-ignore
        clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: PORT }, async () => {
            // initialize client DHT table
            let clientID = singleton.getPeerID(clientSocket.localAddress, PORT)

            serverPeer = {
                peerName: myName, // client name
                peerIP: clientSocket.localAddress as string,
                peerPort: PORT,
                peerID: clientID,
                keyID: singleton.getKeyID(imageName[myName]),
                peerImagePort: singleton.getPort()
            };

            serverDHT = {
                owner: serverPeer,
                table: []
            }


            let senderPeerID = singleton.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort)

            //once connected, the server will reply with the join packet that contains all the bucket data
            clientSocket.on('data', (message: Buffer) => {
                let kadPacket: JoinPacket = dissectJoinPacket(message);

                //sender peer is the peer that we concted too
                let senderPeerName = kadPacket.senderName;
                let senderPeer: Peer = {
                    peerName: senderPeerName,
                    peerIP: clientSocket.remoteAddress as string,
                    peerPort: clientSocket.remotePort as number,
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
                    //run my own server 
                    runServer(myName, clientSocket.localAddress as string, clientSocket.localPort as number, serverDHT)

                    //display packet data
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
                    //add details from join packet to my own table
                    updateDHTtable(serverDHT, kadPacket.peerList)

                } else {
                    // Later we will consider other message types.
                    console.log("The message type " + kadPacket.messageType + " is not supported")
                }
            });
            //when the server kills the connection, send hello's to other peers
            clientSocket.on("end",  () => {
                // disconnected from server
                sendHello(serverDHT).then(() => {
                    clientSocket.destroy()
                    resolve(null)     
                })
            })
        });
    })
}

//server function, handles all requests after the peer has either joined the network or started a new one
const runServer = (clientName: string, localAddress: string, localPort: number, DHTtable: DHTADT) => {
    let myReceivingPort = null;
    let mySendingPort = null;
    // Now run as a server
    myReceivingPort = localPort;
    let localPeerID = singleton.getPeerID(localAddress, myReceivingPort);

    //create the server socket
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

//function for when a client joins my own server
function handleClient(sock: Socket, serverDHTtable: DHTADT) {
    let kadPacket: JoinPacket | null = null
    let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;
    let rawData: Buffer | null = null

    // initialize client DHT table
    let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort)
    let joiningPeer: Peer = {
        peerName: "",
        peerIP: sock.remoteAddress as string,
        peerPort: sock.remotePort as number,
        peerID: joiningPeerID
    };

    // Triggered only when the client is sending kadPTP message
    sock.on('data', (message: Buffer) => {
        //save the raw data and dissect it
        rawData = message
        kadPacket = dissectJoinPacket(message);
    });

    sock.on('end', async () => {
        // client edded the connection
        //if a packet is provided, meaning the peer is on the network
        if (kadPacket) {
            //if kadpacket message type is 2, its a hello packet
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
            //if cad packet is 3, its a search packet, re disect the raw data to a search packer
            if (kadPacket.messageType === 3) {
                let searchPacket = dissectSearchPacket(rawData as Buffer)
                console.log("Received Search Message from " + searchPacket.senderName + "\n");
                console.log(
                    "Version: " + searchPacket.version + "\n" +
                    "TimeStamp: " + singleton.getTimestamp() + "\n" +
                    "Request Type: " + "Query" + "\n" +
                    "Image Name: " + searchPacket.imageName + "\n"
                )
                    
                //wait 0.5s for fun
                await new Promise(resolve => setTimeout(resolve, 500));

                //wait for the server to either find the image, return it, or send the packet to aonther peer
                await ((): Promise<null> => {
                    return new Promise(resolve => {
                        //if the server has the image
                        if (singleton.getKeyID(searchPacket.imageName + "." + serverImageName.split(".")[1]) === serverPeer.keyID) {
                            console.log("The requested Image Was found, sending image \n")
                            //get the image socket from the message
                            let imageSocket = new net.Socket()

                            let imgData = fs.readFileSync(__dirname + "\\" + serverImageName)
                            //connect to the peers image server asking for the image
                            imageSocket.connect({ port: searchPacket.originatingImagePort, host: searchPacket.originatingIP }, () => {
                                //send the image info to the peer
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
                            //image doesnt exist here, send the image request to the next closest peer
                            console.log("The requested Image Was not found, sending request to closest peer \n")
                            sock.end()
                            sock.destroy()
                            //wait 0.5ms for fun, so socket can end and a new one can be made, after waiting run the search function
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