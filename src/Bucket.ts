import { getJoinPacket } from "./KADpackets";
import { DHTADT, Peer, K_bucket } from "./types";
import singleton from "./Singleton";
import net from "net"

export function updateDHTtable(DHTtable: DHTADT, list: Array<Peer>) {
    // Refresh the local k-buckets using the transmitted list of peers. 

    refreshBucket(DHTtable, list)
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

export function getClosest(dht: DHTADT): Peer{
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
   return dht.table[0].peer
}

export function refreshBucket(T: DHTADT, peersList: Array<Peer>) {
    peersList.forEach(P => {
        pushBucket(T, P);
    });
}

// pushBucket method stores the peer’s information (IP address, port number, and peer ID) 
// into the appropriate k-bucket of the DHTtable. 
export function pushBucket(T: DHTADT, P: Peer) {
    // First make sure that the given peer is not the loacl peer itself, then  
    // determine the prefix i which is the maximum number of the leftmost bits shared between  
    // peerID the owner of the DHTtable and the given peer ID. 

    if (T.owner.peerID != P.peerID) {
        let localID = singleton.Hex2Bin(T.owner.peerID);
        let receiverID = singleton.Hex2Bin(P.peerID);
        // Count how many bits match
        let i = 0;
        for (i = 0; i < localID.length; i++) {
            if (localID[i] != receiverID[i])
                break;
        }

        let k_bucket: K_bucket = {
            bits: i,
            peer: P
        };

        let exist = T.table.find(e => e.bits === i);
        if (exist) {
            // insert the closest 
            if (singleton.XORing(localID, singleton.Hex2Bin(k_bucket.peer.peerID)) <
                singleton.XORing(localID, singleton.Hex2Bin(exist.peer.peerID))) {
                // remove the existing one
                for (var k = 0; k < T.table.length; k++) {
                    if (T.table[k].peer.peerID == exist.peer.peerID) {
                        console.log("** The peer " + exist.peer.peerID + " is removed and\n** The peer " +
                            k_bucket.peer.peerID + " is added instead")
                        T.table.splice(k, 1);
                        break;
                    }
                }
                // add the new one    
                T.table.push(k_bucket);
            }
        } else {
            T.table.push(k_bucket);
        }
    }

}
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time. 
export async function sendHello(T: DHTADT) {
    let i = 0;
    // we use echoPeer method to do recursive method calls
    await echoPeer(T, i);
}

// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
export function echoPeer(T: DHTADT, i: number): Promise<null> {
    console.log("Sending Hello \n")
    return new Promise((resolve) => {
        setTimeout(() => {
            let sock = new net.Socket();
            sock.connect({ port: T.table[i].peer.peerPort, host: T.table[i].peer.peerIP, localPort: T.owner.peerPort }, () => {

                let peerList: Array<Peer> = T.table.map((e) => {
                    return e.peer
                })

                let packet = getJoinPacket({
                    version: 7,
                    messageType: 2,
                    numberOfPeers: peerList.length,
                    senderName: T.owner.peerName,
                    peerList: peerList
                })

                sock.write(packet);

                setTimeout(() => {
                    sock.end();
                    sock.destroy();
                }, 500)
            }
            );
            sock.on('close', () => {
                i++;
                if (i < T.table.length) {
                    echoPeer(T, i).then(()=> {
                        resolve(null)
                    })
                }
            })
            if (i == T.table.length - 1) {
                console.log("Hello packets have been sent.\n");
                resolve(null);
            }
        }, 500)
    })
}
