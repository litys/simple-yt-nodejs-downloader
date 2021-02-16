const fs = require('fs');
const ytdl = require('ytdl-core');

const path = require('path');
const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
})

app.post('/mp3', (req, res) => {
    convert('mp3',req.body.video);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
})
app.post('/mp4', (req, res) => {
    convert('mp4',req.body.video);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
})
app.post('/mkv', (req, res) => {
    convert('mkv',req.body.video);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
})

app.listen(port, () => {
  console.log(`YT Downloader listening at http://localhost:${port}`)
})

function convert(quality,url){

    (async () => {
        // Downloading data about video
        var name = await ytdl.getInfo(url);
        name = name.player_response.videoDetails.title;

        // Replacing special characters (eg. icons)
        name = name.replace(/[^a-zA-Z0-9_ -.,]/g,'_').replace(/_{2,}/g,'_');
        
        if(quality=='mp4') convert_360p(name,url);
        else if(quality=='mkv') covert_best(name,url);
        else if(quality=='mp3') convert_mp3(name,url);
    })();
}

// Download only music
function convert_mp3(name,url){
    ytdl(url, {quality: 'highestaudio'})
        .pipe(fs.createWriteStream('mp3/'+name+'.mp3'));
}

// Download video 360p with music - fastest way
function convert_360p(name,url){
    ytdl(url)
        .pipe(fs.createWriteStream('mp4/'+name+'.mp4'));
}

// Download max quality video & sound
// It's just example from documentation https://github.com/fent/node-ytdl-core/blob/master/example/ffmpeg.js
function covert_best(name,url){
    // Buildin with nodejs
    const cp = require('child_process');
    const readline = require('readline');
    // External modules
    const ffmpeg = require('ffmpeg-static');
    // Global constants
    const ref = url;
    const tracker = {
    start: Date.now(),
    audio: { downloaded: 0, total: Infinity },
    video: { downloaded: 0, total: Infinity },
    merged: { frame: 0, speed: '0x', fps: 0 },
    };

    // Get audio and video streams
    const audio = ytdl(ref, { quality: 'highestaudio' })
    .on('progress', (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
    });
    const video = ytdl(ref, { quality: 'highestvideo' })
    .on('progress', (_, downloaded, total) => {
        tracker.video = { downloaded, total };
    });

    // Prepare the progress bar
    let progressbarHandle = null;
    const progressbarInterval = 1000;
    const showProgress = () => {
    readline.cursorTo(process.stdout, 0);
    const toMB = i => (i / 1024 / 1024).toFixed(2);

    process.stdout.write(`Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB).${' '.repeat(10)}\n`);

    process.stdout.write(`Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed `);
    process.stdout.write(`(${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB).${' '.repeat(10)}\n`);

    process.stdout.write(`Merged | processing frame ${tracker.merged.frame} `);
    process.stdout.write(`(at ${tracker.merged.fps} fps => ${tracker.merged.speed}).${' '.repeat(10)}\n`);

    process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
    readline.moveCursor(process.stdout, 0, -3);
    };

    // Start the ffmpeg child process
    const ffmpegProcess = cp.spawn(ffmpeg, [
    // Remove ffmpeg's console spamming
    '-loglevel', '8', '-hide_banner',
    // Redirect/Enable progress messages
    '-progress', 'pipe:3',
    // Set inputs
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    // Map audio & video from streams
    '-map', '0:a',
    '-map', '1:v',
    // Keep encoding
    '-c:v', 'copy',
    // Define output file
    'mkv/'+name+'.mkv',
    ], {
    windowsHide: true,
    stdio: [
        /* Standard: stdin, stdout, stderr */
        'inherit', 'inherit', 'inherit',
        /* Custom: pipe:3, pipe:4, pipe:5 */
        'pipe', 'pipe', 'pipe',
    ],
    });
    ffmpegProcess.on('close', () => {
    console.log('done');
    // Cleanup
    process.stdout.write('\n\n\n\n');
    clearInterval(progressbarHandle);
    });

    // Link streams
    // FFmpeg creates the transformer streams and we just have to insert / read data
    ffmpegProcess.stdio[3].on('data', chunk => {
    // Start the progress bar
    if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
    // Parse the param=value list returned by ffmpeg
    const lines = chunk.toString().trim().split('\n');
    const args = {};
    for (const l of lines) {
        const [key, value] = l.split('=');
        args[key.trim()] = value.trim();
    }
    tracker.merged = args;
    });
    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
}