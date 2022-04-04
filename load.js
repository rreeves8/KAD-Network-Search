const fs = require('fs');

let root = __dirname

//loop through each peer folder, make copies of each processed js files into the peer folders
for (let i = 1; i <= 5; i++) {
    let fileNames = ["Bucket.js", "KADpeer.js", "KADpackets.js", "Singleton.js"]

    fileNames.forEach(e => {
        if (!fs.existsSync(root + `\\build\\peer` + i.toString() + `\\`)){
            fs.mkdirSync(root + `\\build\\peer` + i.toString() + `\\`);
        }

        fs.copyFile(root + '\\dist\\' + e, root + `\\build\\peer` + i.toString() + `\\` + e, (err) => {
            if (err) throw err;
        });
    })
}

console.log('Files were copied to destination');