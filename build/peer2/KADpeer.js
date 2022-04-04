"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = __importDefault(require("net"));
const Singleton_1 = __importDefault(require("./Singleton"));
const os_1 = __importDefault(require("os"));
const KADpackets_1 = require("./KADpackets");
const Bucket_1 = require("./Bucket");
const fs_1 = __importDefault(require("fs"));
const open_1 = __importDefault(require("open"));
Singleton_1.default.init();
let portOBJ = {
    "peer1": 2001,
    "peer2": 2055,
    "peer3": 2077,
    "peer4": 2044,
    "peer5": 2005,
};
let imageName = {
    "peer1": "Canna.gif",
    "peer2": "Flicker.jpeg",
    "peer3": "CherryBlossom.gif",
    "peer4": "Parrot.jpeg",
    "peer5": "Cardinal.jpeg",
};
// get current folder name
let path = __dirname.split("\\");
let myName = path[path.length - 1];
let ifaces = os_1.default.networkInterfaces();
let HOST = "";
let PORT = portOBJ[myName];
let serverImageName = imageName[myName];
// get the loaclhost ip address
Object.keys(ifaces).forEach(function (ifname) {
    //@ts-ignore
    ifaces[ifname].forEach(function (iface) {
        if ("IPv4" == iface.family && iface.internal !== false) {
            HOST = iface.address;
        }
    });
});
let serverID = Singleton_1.default.getPeerID(HOST, PORT);
let serverPeer;
let serverDHT;
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (process.argv.length > 2) {
            yield connectToNetwork();
            console.log("Joined Network \n");
            if (process.argv[5]) {
                let imageName = process.argv[5];
                console.log("Searching the network for image: " + imageName + "\n");
                imageServer(imageName);
                let imageComp = imageName.split('.');
                search({
                    version: 7,
                    messageType: 3,
                    senderName: serverPeer.peerName,
                    originatingIP: serverPeer.peerIP,
                    originatingImagePort: serverPeer.peerImagePort,
                    imageType: imageComp[1],
                    imageName: imageComp[0]
                }, null);
            }
        }
        else {
            serverPeer = {
                peerName: myName,
                peerIP: HOST,
                peerPort: PORT,
                peerID: serverID,
                peerImagePort: Singleton_1.default.getPort(),
                keyID: Singleton_1.default.getKeyID(imageName[myName]),
            };
            serverDHT = {
                owner: serverPeer,
                table: []
            };
            runServer(serverPeer.peerName, serverPeer.peerIP, serverPeer.peerPort, serverDHT);
        }
    }
    catch (e) {
        throw e;
    }
});
const search = (searchPacket, resolve) => {
    let clientSocket = new net_1.default.Socket();
    let closestPeer = (0, Bucket_1.getClosest)(serverDHT);
    try {
        clientSocket.connect({ port: closestPeer.peerPort, host: closestPeer.peerIP }, () => {
            clientSocket.write((0, KADpackets_1.getSearchPacket)(searchPacket));
            clientSocket.end();
            if (resolve) {
                resolve(null);
            }
        });
    }
    catch (e) {
        console.log(e);
        if (resolve) {
            resolve(null);
        }
    }
};
const imageServer = (imageName) => {
    console.log("Creating Image server \n");
    let serverSocket = net_1.default.createServer();
    let imageSocket = serverPeer.peerImagePort;
    let imageID = serverPeer.keyID;
    serverSocket.listen(imageSocket, HOST);
    serverSocket.on("connection", (socket) => {
        socket.on("data", (data) => {
            let imagePacket = (0, KADpackets_1.dissectImagePacket)(data);
            console.log("Got image Packet \n" +
                "Version: " + imagePacket.version + "\n" +
                "sequenceNumber: " + imagePacket.sequenceNumber + "\n" +
                "timeStamp: " + imagePacket.timeStamp + "\n");
            fs_1.default.writeFileSync(imageName, imagePacket.imageData);
            (0, open_1.default)(__dirname + "\\" + imageName, { wait: true });
        });
    });
};
const connectToNetwork = () => {
    return new Promise(resolve => {
        let clientSocket = new net_1.default.Socket();
        let firstFlag = process.argv[2]; // should be -p
        let hostserverIPandPort = process.argv[3].split(":");
        let knownHOST = hostserverIPandPort[0];
        let knownPORT = hostserverIPandPort[1];
        //@ts-ignore
        clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: PORT }, () => __awaiter(void 0, void 0, void 0, function* () {
            // initialize client DHT table
            let clientID = Singleton_1.default.getPeerID(clientSocket.localAddress, PORT);
            serverPeer = {
                peerName: myName,
                peerIP: clientSocket.localAddress,
                peerPort: PORT,
                peerID: clientID,
                keyID: Singleton_1.default.getKeyID(imageName[myName]),
                peerImagePort: Singleton_1.default.getPort()
            };
            serverDHT = {
                owner: serverPeer,
                table: []
            };
            let senderPeerID = Singleton_1.default.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort);
            clientSocket.on('data', (message) => {
                let kadPacket = (0, KADpackets_1.dissectJoinPacket)(message);
                let senderPeerName = kadPacket.senderName;
                let senderPeer = {
                    peerName: senderPeerName,
                    peerIP: clientSocket.remoteAddress,
                    peerPort: clientSocket.remotePort,
                    peerID: senderPeerID
                };
                if (kadPacket.messageType == 1) {
                    // This message comes from the server
                    console.log("Connected to " +
                        senderPeerName +
                        ":" +
                        clientSocket.remotePort +
                        " at timestamp: " +
                        Singleton_1.default.getTimestamp() + "\n");
                    runServer(myName, clientSocket.localAddress, clientSocket.localPort, serverDHT);
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
                    }
                    else {
                        console.log("  along with DHT: []\n");
                    }
                    // add the bootstrap node into the DHT table but only if it is not exist already
                    let exist = serverDHT.table.find(e => e.peer.peerPort == clientSocket.remotePort);
                    if (!exist) {
                        (0, Bucket_1.pushBucket)(serverDHT, senderPeer);
                    }
                    else {
                        console.log(senderPeer.peerPort + " is exist already");
                    }
                    (0, Bucket_1.updateDHTtable)(serverDHT, kadPacket.peerList);
                }
                else {
                    // Later we will consider other message types.
                    console.log("The message type " + kadPacket.messageType + " is not supported");
                }
            });
            clientSocket.on("end", () => {
                // disconnected from server
                (0, Bucket_1.sendHello)(serverDHT).then(() => {
                    clientSocket.destroy();
                    resolve(null);
                });
            });
        }));
    });
};
const runServer = (clientName, localAddress, localPort, DHTtable) => {
    let myReceivingPort = null;
    let mySendingPort = null;
    // Now run as a server
    myReceivingPort = localPort;
    let localPeerID = Singleton_1.default.getPeerID(localAddress, myReceivingPort);
    let serverPeer = net_1.default.createServer();
    serverPeer.listen(myReceivingPort, localAddress);
    console.log("This peer address is " +
        localAddress +
        ":" +
        myReceivingPort +
        " located at " +
        clientName +
        " [" + localPeerID + "]\n");
    // Wait for other peers to connect
    serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock, DHTtable);
    });
};
function handleClient(sock, serverDHTtable) {
    let kadPacket = null;
    let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;
    let rawData = null;
    // initialize client DHT table
    let joiningPeerID = Singleton_1.default.getPeerID(sock.remoteAddress, sock.remotePort);
    let joiningPeer = {
        peerName: "",
        peerIP: sock.remoteAddress,
        peerPort: sock.remotePort,
        peerID: joiningPeerID
    };
    // Triggered only when the client is sending kadPTP message
    sock.on('data', (message) => {
        rawData = message;
        kadPacket = (0, KADpackets_1.dissectJoinPacket)(message);
    });
    sock.on('end', () => __awaiter(this, void 0, void 0, function* () {
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
                }
                else {
                    (0, Bucket_1.pushBucket)(serverDHTtable, joiningPeer);
                }
                // Now update the DHT table
                (0, Bucket_1.updateDHTtable)(serverDHTtable, kadPacket.peerList);
            }
            if (kadPacket.messageType === 3) {
                let searchPacket = (0, KADpackets_1.dissectSearchPacket)(rawData);
                console.log("Received Search Message from " + searchPacket.senderName + "\n");
                console.log("Version: " + searchPacket.version + "\n" +
                    "TimeStamp: " + Singleton_1.default.getTimestamp() + "\n" +
                    "Request Type: " + "Query" + "\n" +
                    "Image Name: " + searchPacket.imageName + "\n");
                yield new Promise(resolve => setTimeout(resolve, 500));
                yield (() => {
                    return new Promise(resolve => {
                        if (Singleton_1.default.getKeyID(searchPacket.imageName + "." + serverImageName.split(".")[1]) === serverPeer.keyID) {
                            console.log("The requested Image Was found, sending image \n");
                            let imageSocket = new net_1.default.Socket();
                            let imgData = fs_1.default.readFileSync(__dirname + "\\" + serverImageName);
                            imageSocket.connect({ port: searchPacket.originatingImagePort, host: searchPacket.originatingIP }, () => {
                                imageSocket.write((0, KADpackets_1.getImagePacket)({
                                    version: 7,
                                    messageType: 4,
                                    sequenceNumber: Singleton_1.default.getSequenceNumber(),
                                    timeStamp: Singleton_1.default.getTimestamp(),
                                    imageSize: imgData.length,
                                    imageData: imgData
                                }));
                                imageSocket.end();
                                resolve(null);
                            });
                        }
                        else {
                            console.log("The requested Image Was not found, sending request to closest peer \n");
                            sock.end();
                            sock.destroy();
                            new Promise(resolve => setTimeout(resolve, 500)).then(() => {
                                search(searchPacket, resolve);
                            });
                        }
                    });
                })();
            }
        }
        else {
            // This was a bootstrap request
            console.log("Connected from peer " + joiningPeerAddress + "\n");
            // add the requester info into server DHT table
            (0, Bucket_1.pushBucket)(serverDHTtable, joiningPeer);
        }
    }));
    if (kadPacket == null) {
        // This is a bootstrap request
        // send acknowledgment to the client
        let packet = (0, KADpackets_1.getJoinPacket)({
            version: 7,
            messageType: 1,
            peerList: serverDHTtable.table.map((e) => {
                return e.peer;
            }),
            numberOfPeers: serverDHTtable.table.length,
            senderName: serverDHTtable.owner.peerName
        });
        sock.write(packet);
        sock.end();
    }
}
main();
//# sourceMappingURL=KADpeer.js.map