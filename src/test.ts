import { dissectJoinPacket, getJoinPacket, getImagePacket, dissectImagePacket, getSearchPacket, dissectSearchPacket } from "./kadPTPmessage";
import { K_bucket, Peer } from "./types";
import fs from "fs"
import open from "open"
import net from "net"

const testPackets = () => {
    let table: Array<K_bucket> = new Array<K_bucket>(10)

    table.fill({
        peer: { peerID: "wer", peerName: "Jacob", peerIP: "127.0.0.1", peerPort: 33 },
        bits: 1234
    })

    let serverDHTtable = {
        owner: { peerID: "wer", peerName: "Jacob", peerIP: "127.0.0.1", peerPort: 33 },
        table: table
    }

    let packet = getJoinPacket({
        version: 7,
        messageType: 1,
        peerList: serverDHTtable.table.map((e) => {
            return e.peer
        }),
        numberOfPeers: serverDHTtable.table.length,
        senderName: serverDHTtable.owner.peerName
    })
    console.log(serverDHTtable.table.length)

    console.log(dissectJoinPacket(packet))

    console.log("\n \n")

    let imgData = fs.readFileSync(__dirname + "\\CallaLily.gif")

    let imagePacket = getImagePacket({
        version: 7,
        messageType: 1,
        sequenceNumber: 5,
        timeStamp: 5,
        imageSize: imgData.length,
        imageData: imgData
    })

    let response = dissectImagePacket(imagePacket)
    console.log(response)

    fs.writeFileSync("CallaLily1.gif", response.imageData);

    open(__dirname + "\\CallaLily1.gif", { wait: true })

    let searchPacket = getSearchPacket({
        version: 7,
        messageType: 2,
        senderName: "magnus",
        originatingIP: "127.0.0.1",
        originatingImagePort: 1000,
        imageType: "gif",
        imageName: "Calla"
    })

    console.log(dissectSearchPacket(searchPacket))
}

const testServer = () => {
    let sock = new net.Socket()

    let localPort = 8080
    let port = 2055
    let ip = "127.0.0.1"

    sock.connect({ port: port, host: ip, localPort: localPort }, () => {
        let packet = getSearchPacket({
            version: 7,
            messageType: 3,
            senderName: "magnus",
            originatingIP: ip,
            originatingImagePort: localPort,
            imageType: "gay",
            imageName: "gayer"
        })

        sock.write(packet);
    })

}

const testSearchPacket = () => {
    let searchPacket = getSearchPacket({
        version: 7,
        messageType: 2,
        senderName: "magnus",
        originatingIP: "127.0.0.1",
        originatingImagePort: 1000,
        imageType: "gif",
        imageName: "Calla"
    })

    console.log(dissectSearchPacket(searchPacket))
}

testServer()