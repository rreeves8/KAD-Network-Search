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
exports.echoPeer = exports.sendHello = exports.pushBucket = exports.refreshBucket = exports.getClosest = exports.updateDHTtable = void 0;
const KADpackets_1 = require("./KADpackets");
const Singleton_1 = __importDefault(require("./Singleton"));
const net_1 = __importDefault(require("net"));
function updateDHTtable(DHTtable, list) {
    // Refresh the local k-buckets using the transmitted list of peers. 
    refreshBucket(DHTtable, list);
    console.log("Refresh k-Bucket operation is performed.\n");
    if (DHTtable.table.length > 0) {
        let output = "My DHT: ";
        for (var i = 0; i < DHTtable.table.length; i++) {
            output +=
                "[" +
                    DHTtable.table[i].peer.peerIP + ":" +
                    DHTtable.table[i].peer.peerPort + ", " +
                    DHTtable.table[i].peer.peerID +
                    "]\n        ";
        }
        console.log(output);
    }
}
exports.updateDHTtable = updateDHTtable;
function getClosest(dht) {
    /*
    let peerList: Array<K_bucket> = dht.table;
    let closestIndex: number = 0

    peerList.forEach((e: K_bucket, i: number) => {
        let newBits = new Number(singleton.XORing(dht.owner.peerID, e.peer.peerID)).valueOf()
        let prevBits = new Number(singleton.XORing(dht.owner.peerID, peerList[closestIndex].peer.peerID )).valueOf()
        
        if(newBits < prevBits){
            closestIndex = i
        }
    })

    return peerList[closestIndex].peer
    */
    return dht.table[0].peer;
}
exports.getClosest = getClosest;
function refreshBucket(T, peersList) {
    peersList.forEach(P => {
        pushBucket(T, P);
    });
}
exports.refreshBucket = refreshBucket;
// pushBucket method stores the peer’s information (IP address, port number, and peer ID) 
// into the appropriate k-bucket of the DHTtable. 
function pushBucket(T, P) {
    // First make sure that the given peer is not the loacl peer itself, then  
    // determine the prefix i which is the maximum number of the leftmost bits shared between  
    // peerID the owner of the DHTtable and the given peer ID. 
    if (T.owner.peerID != P.peerID) {
        let localID = Singleton_1.default.Hex2Bin(T.owner.peerID);
        let receiverID = Singleton_1.default.Hex2Bin(P.peerID);
        // Count how many bits match
        let i = 0;
        for (i = 0; i < localID.length; i++) {
            if (localID[i] != receiverID[i])
                break;
        }
        let k_bucket = {
            bits: i,
            peer: P
        };
        let exist = T.table.find(e => e.bits === i);
        if (exist) {
            // insert the closest 
            if (Singleton_1.default.XORing(localID, Singleton_1.default.Hex2Bin(k_bucket.peer.peerID)) <
                Singleton_1.default.XORing(localID, Singleton_1.default.Hex2Bin(exist.peer.peerID))) {
                // remove the existing one
                for (var k = 0; k < T.table.length; k++) {
                    if (T.table[k].peer.peerID == exist.peer.peerID) {
                        console.log("** The peer " + exist.peer.peerID + " is removed and\n** The peer " +
                            k_bucket.peer.peerID + " is added instead");
                        T.table.splice(k, 1);
                        break;
                    }
                }
                // add the new one    
                T.table.push(k_bucket);
            }
        }
        else {
            T.table.push(k_bucket);
        }
    }
}
exports.pushBucket = pushBucket;
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time. 
function sendHello(T) {
    return __awaiter(this, void 0, void 0, function* () {
        let i = 0;
        // we use echoPeer method to do recursive method calls
        yield echoPeer(T, i);
    });
}
exports.sendHello = sendHello;
// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
function echoPeer(T, i) {
    console.log("Sending Hello \n");
    return new Promise((resolve) => {
        setTimeout(() => {
            let sock = new net_1.default.Socket();
            sock.connect({ port: T.table[i].peer.peerPort, host: T.table[i].peer.peerIP, localPort: T.owner.peerPort }, () => {
                let peerList = T.table.map((e) => {
                    return e.peer;
                });
                let packet = (0, KADpackets_1.getJoinPacket)({
                    version: 7,
                    messageType: 2,
                    numberOfPeers: peerList.length,
                    senderName: T.owner.peerName,
                    peerList: peerList
                });
                sock.write(packet);
                setTimeout(() => {
                    sock.end();
                    sock.destroy();
                }, 500);
            });
            sock.on('close', () => {
                i++;
                if (i < T.table.length) {
                    echoPeer(T, i).then(() => {
                        resolve(null);
                    });
                }
            });
            if (i == T.table.length - 1) {
                console.log("Hello packets have been sent.\n");
                resolve(null);
            }
        }, 500);
    });
}
exports.echoPeer = echoPeer;
//# sourceMappingURL=Bucket.js.map