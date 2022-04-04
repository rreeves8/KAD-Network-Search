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
const kadPTPmessage_1 = require("./kadPTPmessage");
const Singleton_1 = __importDefault(require("./Singleton"));
const Bucket_1 = require("./Bucket");
let myReceivingPort = null;
let mySendingPort = null;
let peersList = [];
exports.default = {
    handleClientJoining: function (sock, serverDHTtable) {
        // accept anyways in this assignment
        handleClient(sock, serverDHTtable);
    },
    handleCommunications: function (clientSocket, clientName, clientDHTtable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield communicate(clientSocket, clientName, clientDHTtable);
        });
    }
};
function handleClient(sock, serverDHTtable) {
    let kadPacket = null;
    let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;
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
        try {
            kadPacket = (0, kadPTPmessage_1.dissectJoinPacket)(message);
        }
        catch (e) {
            try {
                kadPacket = (0, kadPTPmessage_1.dissectSearchPacket)(message);
            }
            catch (e) {
                throw e;
            }
        }
    });
    sock.on('end', () => {
        // client edded the connection
        if (kadPacket) {
            // Here, the msgType cannot be 1. It can be 2 or greater
            if (kadPacket.messageType == 2) {
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
        }
        else {
            // This was a bootstrap request
            console.log("Connected from peer " + joiningPeerAddress + "\n");
            // add the requester info into server DHT table
            (0, Bucket_1.pushBucket)(serverDHTtable, joiningPeer);
        }
    });
    if (kadPacket == null) {
        // This is a bootstrap request
        // send acknowledgment to the client
        let packet = (0, kadPTPmessage_1.getJoinPacket)({
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
function communicate(clientSocket, clientName, clientDHTtable) {
    return new Promise(resolve => {
        let senderPeerID = Singleton_1.default.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort);
        clientSocket.on('data', (message) => {
            let kadPacket = (0, kadPTPmessage_1.dissectJoinPacket)(message);
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
                // Now run as a server
                myReceivingPort = clientSocket.localPort;
                let localPeerID = Singleton_1.default.getPeerID(clientSocket.localAddress, myReceivingPort);
                let serverPeer = net_1.default.createServer();
                serverPeer.listen(myReceivingPort, clientSocket.localAddress);
                console.log("This peer address is " +
                    clientSocket.localAddress +
                    ":" +
                    myReceivingPort +
                    " located at " +
                    clientName +
                    " [" + localPeerID + "]\n");
                // Wait for other peers to connect
                serverPeer.on("connection", function (sock) {
                    // again we will accept all connections in this assignment
                    handleClient(sock, clientDHTtable);
                });
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
                let exist = clientDHTtable.table.find(e => e.peer.peerPort == clientSocket.remotePort);
                if (!exist) {
                    (0, Bucket_1.pushBucket)(clientDHTtable, senderPeer);
                }
                else {
                    console.log(senderPeer.peerPort + " is exist already");
                }
                (0, Bucket_1.updateDHTtable)(clientDHTtable, kadPacket.peerList);
            }
            else {
                // Later we will consider other message types.
                console.log("The message type " + kadPacket.messageType + " is not supported");
            }
        });
        clientSocket.on("end", () => __awaiter(this, void 0, void 0, function* () {
            // disconnected from server
            yield (0, Bucket_1.sendHello)(clientDHTtable);
            resolve(null);
        }));
    });
}
//# sourceMappingURL=PeersHandler.js.map