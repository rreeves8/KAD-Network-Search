"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kadPTPmessage_1 = require("./kadPTPmessage");
const fs_1 = __importDefault(require("fs"));
const open_1 = __importDefault(require("open"));
const net_1 = __importDefault(require("net"));
const testPackets = () => {
    let table = new Array(10);
    table.fill({
        peer: { peerID: "wer", peerName: "Jacob", peerIP: "127.0.0.1", peerPort: 33 },
        bits: 1234
    });
    let serverDHTtable = {
        owner: { peerID: "wer", peerName: "Jacob", peerIP: "127.0.0.1", peerPort: 33 },
        table: table
    };
    let packet = (0, kadPTPmessage_1.getJoinPacket)({
        version: 7,
        messageType: 1,
        peerList: serverDHTtable.table.map((e) => {
            return e.peer;
        }),
        numberOfPeers: serverDHTtable.table.length,
        senderName: serverDHTtable.owner.peerName
    });
    console.log(serverDHTtable.table.length);
    console.log((0, kadPTPmessage_1.dissectJoinPacket)(packet));
    console.log("\n \n");
    let imgData = fs_1.default.readFileSync(__dirname + "\\CallaLily.gif");
    let imagePacket = (0, kadPTPmessage_1.getImagePacket)({
        version: 7,
        messageType: 1,
        sequenceNumber: 5,
        timeStamp: 5,
        imageSize: imgData.length,
        imageData: imgData
    });
    let response = (0, kadPTPmessage_1.dissectImagePacket)(imagePacket);
    console.log(response);
    fs_1.default.writeFileSync("CallaLily1.gif", response.imageData);
    (0, open_1.default)(__dirname + "\\CallaLily1.gif", { wait: true });
    let searchPacket = (0, kadPTPmessage_1.getSearchPacket)({
        version: 7,
        messageType: 2,
        senderName: "magnus",
        originatingIP: "127.0.0.1",
        originatingImagePort: 1000,
        imageType: "gif",
        imageName: "Calla"
    });
    console.log((0, kadPTPmessage_1.dissectSearchPacket)(searchPacket));
};
const testServer = () => {
    let sock = new net_1.default.Socket();
    let localPort = 8080;
    let port = 2055;
    let ip = "127.0.0.1";
    sock.connect({ port: port, host: ip, localPort: localPort }, () => {
        let packet = (0, kadPTPmessage_1.getSearchPacket)({
            version: 7,
            messageType: 3,
            senderName: "magnus",
            originatingIP: ip,
            originatingImagePort: localPort,
            imageType: "gay",
            imageName: "gayer"
        });
        sock.write(packet);
    });
};
const testSearchPacket = () => {
    let searchPacket = (0, kadPTPmessage_1.getSearchPacket)({
        version: 7,
        messageType: 2,
        senderName: "magnus",
        originatingIP: "127.0.0.1",
        originatingImagePort: 1000,
        imageType: "gif",
        imageName: "Calla"
    });
    console.log((0, kadPTPmessage_1.dissectSearchPacket)(searchPacket));
};
testServer();
//# sourceMappingURL=test.js.map