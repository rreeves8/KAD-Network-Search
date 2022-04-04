"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dissectImagePacket = exports.getImagePacket = exports.dissectSearchPacket = exports.getSearchPacket = exports.getJoinPacket = exports.dissectJoinPacket = void 0;
const Singleton_1 = __importDefault(require("./Singleton"));
let HEADER_SIZE = 4;
const dissectJoinPacket = (message) => {
    let SenderNameSize = new Number(parseBitPacket(message, 20, 12)).valueOf();
    let kadPacket = {
        version: new Number(parseBitPacket(message, 0, 4)).valueOf(),
        messageType: parseBitPacket(message, 4, 8),
        numberOfPeers: new Number(parseBitPacket(message, 12, 8)).valueOf(),
        senderName: bytes2string(message.slice(4, SenderNameSize + 4)),
        peerList: new Array()
    };
    let bitMarker = 0;
    bitMarker += 4;
    bitMarker += 8;
    bitMarker += 8;
    bitMarker += 12;
    bitMarker += SenderNameSize * 8;
    if (kadPacket.numberOfPeers > 0) {
        for (var i = 0; i < kadPacket.numberOfPeers; i++) {
            let firstOctet = parseBitPacket(message, bitMarker, 8);
            bitMarker += 8;
            let secondOctet = parseBitPacket(message, bitMarker, 8);
            bitMarker += 8;
            let thirdOctet = parseBitPacket(message, bitMarker, 8);
            bitMarker += 8;
            let forthOctet = parseBitPacket(message, bitMarker, 8);
            bitMarker += 8;
            let port = new Number(parseBitPacket(message, bitMarker, 16)).valueOf();
            bitMarker += 16;
            let IP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
            let peerID = Singleton_1.default.getPeerID(IP, port);
            let aPeer = {
                peerIP: IP,
                peerPort: port,
                peerID: peerID,
                peerName: ''
            };
            kadPacket.peerList.push(aPeer);
        }
    }
    return kadPacket;
};
exports.dissectJoinPacket = dissectJoinPacket;
const getJoinPacket = (joinPacket) => {
    let senderName = stringToBytes(joinPacket.senderName);
    let message = Buffer.alloc(HEADER_SIZE + senderName.length + joinPacket.numberOfPeers * 6);
    storeBitPacket(message, joinPacket.version * 1, 0, 4);
    storeBitPacket(message, joinPacket.messageType, 4, 8);
    storeBitPacket(message, joinPacket.numberOfPeers, 12, 8);
    storeBitPacket(message, senderName.length, 20, 12);
    let byteMarker = 4;
    let j = 0;
    let i = 0;
    for (i = byteMarker; i < senderName.length + byteMarker; i++) {
        message[i] = senderName[j++];
    }
    // if number of peer not zero
    if (joinPacket.numberOfPeers > 0) {
        let bitMarker = i * 8; // current bit position
        for (var k = 0; k < joinPacket.numberOfPeers; k++) {
            let IP = joinPacket.peerList[k].peerIP;
            let port = joinPacket.peerList[k].peerPort;
            let firstOctet = new Number(IP.split(".")[0]).valueOf();
            let secondOctet = new Number(IP.split(".")[1]).valueOf();
            let thirdOctet = new Number(IP.split(".")[2]).valueOf();
            let forthOctet = new Number(IP.split(".")[3]).valueOf();
            storeBitPacket(message, firstOctet * 1, bitMarker, 8);
            bitMarker += 8;
            storeBitPacket(message, secondOctet, bitMarker, 8);
            bitMarker += 8;
            storeBitPacket(message, thirdOctet, bitMarker, 8);
            bitMarker += 8;
            storeBitPacket(message, forthOctet, bitMarker, 8);
            bitMarker += 8;
            storeBitPacket(message, port, bitMarker, 16);
            bitMarker += 16;
        }
    }
    return message;
};
exports.getJoinPacket = getJoinPacket;
const getSearchPacket = (searchPacket) => {
    if (searchPacket.imageName.includes(".")) {
        throw new Error("packet name cant contain '.'");
    }
    let senderNameBytes = stringToBytes(searchPacket.senderName);
    let imageNameBytes = stringToBytes(searchPacket.imageName);
    let message = Buffer.alloc((HEADER_SIZE * 4));
    storeBitPacket(message, searchPacket.version * 1, 0, 4);
    storeBitPacket(message, searchPacket.messageType, 4, 8);
    storeBitPacket(message, 0, 12, 8);
    storeBitPacket(message, searchPacket.senderName.length, 20, 12);
    let byteMarker = 4;
    let j = 0;
    let i = 0;
    for (i = byteMarker; i < senderNameBytes.length + byteMarker; i++) {
        message[i] = senderNameBytes[j++];
    }
    let bitMarker = i * 8; // current bit position
    let IP = searchPacket.originatingIP;
    let port = searchPacket.originatingImagePort;
    let firstOctet = new Number(IP.split(".")[0]).valueOf();
    let secondOctet = new Number(IP.split(".")[1]).valueOf();
    let thirdOctet = new Number(IP.split(".")[2]).valueOf();
    let forthOctet = new Number(IP.split(".")[3]).valueOf();
    storeBitPacket(message, firstOctet * 1, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(message, secondOctet, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(message, thirdOctet, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(message, forthOctet, bitMarker, 8);
    bitMarker += 8;
    storeBitPacket(message, port, bitMarker, 16);
    bitMarker += 32;
    let imageBuff = Buffer.alloc(HEADER_SIZE + imageNameBytes.length);
    storeBitPacket(imageBuff, imgTypeNum(searchPacket.imageType), 0, 4);
    storeBitPacket(imageBuff, imageNameBytes.length, 4, 16);
    let byteMarker2 = 4;
    let j2 = 0;
    let i2 = 0;
    for (i2 = byteMarker2; i2 < imageNameBytes.length + byteMarker2; i2++) {
        imageBuff[i2] = imageNameBytes[j2++];
    }
    let packet = Buffer.alloc(imageBuff.length + message.length);
    for (var Hi = 0; Hi < message.length; Hi++)
        packet[Hi] = message[Hi];
    for (var Pi = 0; Pi < imageBuff.length; Pi++)
        packet[Pi + message.length] = imageBuff[Pi];
    return packet;
};
exports.getSearchPacket = getSearchPacket;
const dissectSearchPacket = (message) => {
    let bitMarker = 0;
    let SenderNameSize = new Number(parseBitPacket(message, 20, 12)).valueOf();
    bitMarker += 4;
    bitMarker += 8;
    bitMarker += 12;
    bitMarker += 8;
    bitMarker += SenderNameSize * 8;
    let firstOctet = parseBitPacket(message, bitMarker, 8);
    bitMarker += 8;
    let secondOctet = parseBitPacket(message, bitMarker, 8);
    bitMarker += 8;
    let thirdOctet = parseBitPacket(message, bitMarker, 8);
    bitMarker += 8;
    let forthOctet = parseBitPacket(message, bitMarker, 8);
    bitMarker += 8;
    let port = parseBitPacket(message, bitMarker, 16);
    bitMarker += 16;
    let IP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
    let it = parseBitPacket(message, bitMarker, 4);
    bitMarker += 4;
    let imageSize = new Number(parseBitPacket(message, bitMarker, 28)).valueOf();
    bitMarker += 28;
    let imageName = bytes2string(message.slice((HEADER_SIZE * 4) + 4, imageSize));
    let packet = {
        version: new Number(parseBitPacket(message, 0, 4)).valueOf(),
        messageType: parseBitPacket(message, 4, 8),
        senderName: bytes2string(message.slice(4, SenderNameSize + 4)),
        originatingIP: IP,
        originatingImagePort: new Number(port).valueOf(),
        imageType: imgTypeSTR(it),
        imageName: imageName
    };
    return packet;
};
exports.dissectSearchPacket = dissectSearchPacket;
const getImagePacket = (imagePacket) => {
    let header = Buffer.alloc(HEADER_SIZE * 3);
    storeBitPacket(header, imagePacket.version * 1, 0, 4);
    storeBitPacket(header, imagePacket.messageType, 4, 8);
    storeBitPacket(header, imagePacket.sequenceNumber, 12, 16);
    storeBitPacket(header, imagePacket.timeStamp, 32, 32);
    storeBitPacket(header, imagePacket.imageData.length, 64, 32);
    let payload = Buffer.alloc(imagePacket.imageData.length + 4);
    for (let j = 0; j < imagePacket.imageData.length; j++) {
        payload[j] = imagePacket.imageData[j];
    }
    let packet = Buffer.alloc(payload.length + (HEADER_SIZE * 3));
    for (var Hi = 0; Hi < HEADER_SIZE * 3; Hi++) {
        packet[Hi] = header[Hi];
    }
    for (var Pi = 0; Pi < payload.length; Pi++) {
        packet[Pi + (HEADER_SIZE * 3)] = payload[Pi];
    }
    return packet;
};
exports.getImagePacket = getImagePacket;
const dissectImagePacket = (message) => {
    let header = message.slice(0, 12);
    let payload = message.slice(12);
    let responseName = {
        0: "Query",
        1: "Found",
        2: "Not found",
        3: "Busy",
    };
    let packet = {
        version: parseBitPacket(header, 0, 4),
        messageType: responseName[parseBitPacket(header, 4, 8)],
        sequenceNumber: parseBitPacket(header, 12, 16),
        timeStamp: parseBitPacket(header, 32, 32),
        imageSize: payload.length,
        imageData: payload
    };
    return packet;
};
exports.dissectImagePacket = dissectImagePacket;
function bytes2string(array) {
    var result = "";
    for (var i = 0; i < array.length; ++i) {
        if (array[i] > 0)
            result += String.fromCharCode(array[i]);
    }
    return result;
}
// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
    let number = 0;
    for (var i = 0; i < length; i++) {
        // let us get the actual byte position of the offset
        let bytePosition = Math.floor((offset + i) / 8);
        let bitPosition = 7 - ((offset + i) % 8);
        let bit = (packet[bytePosition] >> bitPosition) % 2;
        number = (number << 1) | bit;
    }
    return number;
}
function stringToBytes(str) {
    var ch, st, re = [];
    for (var i = 0; i < str.length; i++) {
        ch = str.charCodeAt(i); // get char
        st = []; // set up "stack"
        do {
            st.push(ch & 0xff); // push byte to stack
            ch = ch >>> 8; // shift value down by 1 byte
        } while (ch);
        // add stack contents to result
        // done because chars have "wrong" endianness
        re = re.concat(st.reverse());
    }
    // return an array of bytes
    return re;
}
// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
    // let us get the actual byte position of the offset
    let lastBitPosition = offset + length - 1;
    let number = value.toString(2);
    let j = number.length - 1;
    for (var i = 0; i < number.length; i++) {
        let bytePosition = Math.floor(lastBitPosition / 8);
        let bitPosition = 7 - (lastBitPosition % 8);
        if (number.charAt(j--) == "0") {
            packet[bytePosition] &= ~(1 << bitPosition);
        }
        else {
            packet[bytePosition] |= 1 << bitPosition;
        }
        lastBitPosition--;
    }
}
const imgTypeNum = (val) => {
    switch (val) {
        case ('bmp'):
            return 1;
        case ('jpeg'):
            return 2;
        case ('gif'):
            return 3;
        case ('png'):
            return 4;
        case ('tiff'):
            return 5;
        default:
            return 15;
    }
};
const imgTypeSTR = (val) => {
    switch (val) {
        case (1):
            return 'bmp';
        case (2):
            return 'jpeg';
        case (3):
            return "gif";
        case (4):
            return 'png';
        case (5):
            return 'tiff';
        default:
            return 'none';
    }
};
//# sourceMappingURL=KADpackets.js.map