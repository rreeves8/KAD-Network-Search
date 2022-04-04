type JoinPacket = {
    version: number
    messageType: number
    numberOfPeers: number
    senderName: string
    peerList: Array<Peer>
}

type Peer = {
    peerName: string 
    peerIP: string
    peerPort: number,
    peerID: string
}

type Self = {
    peerImagePort: number
    keyID: string
    peerName: string 
    peerIP: string
    peerPort: number,
    peerID: string
}

type DHTADT = {
   owner: Self
   table: Array<K_bucket>  
}
 
type K_bucket = {
    bits: number
    peer: Peer
}

type SearchPacket = {
    version: number
    messageType: number
    senderName: string
    originatingIP: string
    originatingImagePort: number
    imageType: string
    imageName: string
}

type ImagePacket = {
    version: number
    messageType: number | string
    sequenceNumber: number
    timeStamp: number
    imageSize: number
    imageData: Buffer
}

export {
    K_bucket,
    JoinPacket,
    Peer,
    DHTADT,
    SearchPacket,
    ImagePacket,
    Self
}