const fs = require('fs');

let root = __dirname

for (let i = 1; i <= 5; i++) {
    let fileNames = ["Bucket.js", "KADpeer.js", "kadPTPmessage.js", "Singleton.js"]

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
