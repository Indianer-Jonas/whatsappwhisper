import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { whisper } from "whisper-node";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { exec } from "child_process";

const { Client, LocalAuth } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use LocalAuth to handle session saving and restoring
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth ',
        authStrategy: new LocalAuth(),
        clientId: "client-one"
    })
});

const clientSending = new Client({
    authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth ',
        authStrategy: new LocalAuth(),
        clientId: "client-two"
    })
});


const createFluentTranscript = (transcriptArray) => {
    return transcriptArray.map(entry => entry.speech).join(" ");
};


client.on("qr", (qr) => {
    console.log("qr for receiving");
    qrcode.generate(qr, { small: true });
});


clientSending.on("qr", (qr) => {
    console.log("qr for sending");
    qrcode.generate(qr, { small: true });
});



client.on("ready", () => {
    console.log("Client receiving ready!");
});

clientSending.on("ready", () => {
    console.log("Client sending ready!");
});



client.on("message", async msg => {
    if (msg.hasMedia && msg.type === "ptt") { // "ptt" = voice messages
        console.log("Voice message received.");
        const media = await msg.downloadMedia();
        const buffer = Buffer.from(media.data, "base64");
        const oggFilePath = path.join(__dirname, "temp", `${msg.id.id}.ogg`);
        const wavFilePath = path.join(__dirname, "temp", `${msg.id.id}.wav`);

        // Save the voice message to a file
        fs.writeFileSync(oggFilePath, buffer);

        // Convert the voice message to a 16Hz .wav file using ffmpeg
        exec(`ffmpeg -i ${oggFilePath} -ar 16000 ${wavFilePath}`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`Error during conversion: ${error.message}`);
                fs.unlinkSync(oggFilePath);
                return;
            }

            const options = {
                modelName: "base",       // default
                // modelPath: "/custom/path/to/model.bin", // use model in a custom directory (cannot use along with "modelName")
                whisperOptions: {
                    language: "auto",          // default (use "auto" for auto detect)
                    gen_file_txt: false,      // outputs .txt file
                    gen_file_subtitle: false, // outputs .srt file
                    gen_file_vtt: false,      // outputs .vtt file
                    word_timestamps: true     // timestamp for every word
                    // timestamp_size: 0      // cannot use along with word_timestamps:true
                }
            }

            const transcript = await whisper(wavFilePath, options);
            //console.log(createFluentTranscript(transcript));
            //console.log(msg._data.notifyName||msg.from);
            clientSending.sendMessage(client.info.wid._serialized, "*" + (msg._data.notifyName||msg.from) + "*:  " + createFluentTranscript(transcript))
            fs.unlinkSync(wavFilePath);
        });
    }
});

client.initialize();
clientSending.initialize();