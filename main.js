function isMobile() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isAndroid || isiOS;
}

function map(value, inputMin, inputMax, outputMin, outputMax) {
    return (value - inputMin) * (outputMax - outputMin) / (inputMax - inputMin) + outputMin;
}

function lerp(start, stop, amount) {
    return start + (stop - start) * amount;
}

function random(min, max) {
    return min + Math.random() * (max - min);
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

let isReady = false;
const synth = window.speechSynthesis;
const VIDEO_SIZE = 400;
const lerpAmount = 0.5;
let model, ctx, videoWidth, videoHeight, video, canvas;
let position = {
    x: 0.5,
    y: 0.5,
    z: 0.5
};
let rotation = {
    x: 0.5,
    y: 0.5
};
let mouth = 0;
let present = false;
const message = document.getElementById("message");
const mobile = isMobile();
const state = {
    backend: "webgl",
    maxFaces: 1,
    triangulateMesh: false
};

let face = {
    isPresent: false,
    isClose: false,
    isLooking: false,
    isMouthClosed: false
}

const SAID = {
    NOTHING: 0,
    GREETING: 1,
    INTRO: 2,
    IS_NOT_PRESENT: 3,
    IS_PRESENT: 4,
    IS_NOT_CLOSE: 5,
    IS_CLOSE: 6,
    IS_NOT_LOOKING: 7,
    IS_LOOKING: 8,
    IS_NOT_MOUTH_CLOSED: 9,
    IS_MOUTH_CLOSED: 10
}

let saidState = SAID.NOTHING;
const minSilenceTime = 1000;
const maxSilenceTime = 1500;
let numRepeated = 0;

const LINES = {
    GREETING:
        [
            "Hi, thanks for visiting me!",
            "Hi, thanks for finding me!",
            "Hi, thanks for coming!",
            "Hi, how are you today?",
            "Hi, how's your day going?"
        ],
    INTRO:
        [
            "I'm your observer.",
            "I'm your observer.",
            "Now, I'm going to observe you.",
            "Are you ready to be observed?",
            "Now, you will be observed by me."
        ],
    IS_NOT_PRESENT:
        [
            "Please show me your face in the camera.",
            [
                "I still cannot see your face.",
                "Please show me your face.",
                "I said, show me your face.",
                "Please...",
                "Show me your goddamn face.",
                "Alright, I'll wait until you show me your face."
            ],
            "I can no longer see your face."
        ],
    IS_PRESENT:
        [
            "Great! I can see your face.",
            "Now I can see your face."
        ],
    IS_NOT_CLOSE:
        [
            "Your face is not close enough,\ncome closer.",
            [
                "Your face is still not close enough,\ncome closer.",
                "Please move your face closer to the camera.",
                "I said, come closer.",
                "Please...",
                "Come closer you idiot!",
                "Alright, I'll wait until you come closer."
            ],
            "Your face is no longer close enough,\ncome closer."
        ],
    IS_CLOSE:
        [
            "I can see your face is close enough.",
            "Now I can see your face is close enough."
        ],
    IS_NOT_LOOKING:
        [
            "You are not looking at me,\nlook at me.",
            [
                "You are still not looking at me,\nlook at me.",
                "Please look at me!",
                "I said, look at me.",
                "Please...",
                "Look at me you idiot!",
                "Alright, I'll wait until you look at me."
            ],
            "You're no longer looking at me,\nlook at me."
        ],
    IS_LOOKING:
        [
            "I can see you are looking at me.",
            "Now I can see you are looking at me."
        ],
    IS_NOT_MOUTH_CLOSED:
        [
            "Your mouth is not closed,\nclose your mouth.",
            [
                "Your mouth is still not closed,\nclose your mouth.",
                "Please close your mouth.",
                "Will you please shut up?",
                "Please...",
                "Shut your goddamn mouth!",
                "Alright, I'll wait until you shut up."
            ],
            "Your mouth is no longer closed,\nclose your mouth."
        ],
    IS_MOUTH_CLOSED:
        [
            "I can see your mouth is closed.",
            "Now I can see your mouth is closed.",
            [
                "Look at you, you are so beautiful!",
                "You look perfect!",
                "You are the best human I've ever seen.",
                "I love the way you look at me\nwith your mouth shut.",
                "I wish I could see you like this forever.",
                "Alright, now I will shut up."
            ]
        ]
}

function speak() {
    let text = "";
    switch (saidState) {
        case SAID.NOTHING:
            text = randomElement(LINES.GREETING);
            saidState = SAID.GREETING;
            break;
        case SAID.GREETING:
            text = randomElement(LINES.INTRO);
            saidState = SAID.INTRO;
            break;
        case SAID.INTRO:
            if (face.isPresent) {
                text = LINES.IS_PRESENT[0];
                saidState = SAID.IS_PRESENT;
            }
            else {
                text = LINES.IS_NOT_PRESENT[0];
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_NOT_PRESENT:
            if (face.isPresent) {
                numRepeated = 0;
                text = LINES.IS_PRESENT[1];
                saidState = SAID.IS_PRESENT;
            }
            else {
                if (numRepeated < LINES.IS_NOT_PRESENT[1].length) {
                    text = LINES.IS_NOT_PRESENT[1][numRepeated++];
                }
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_PRESENT:
            if (face.isPresent) {
                if (face.isClose) {
                    text = LINES.IS_CLOSE[0];
                    saidState = SAID.IS_CLOSE;
                }
                else {
                    text = LINES.IS_NOT_CLOSE[0];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_NOT_CLOSE:
            if (face.isPresent) {
                if (face.isClose) {
                    numRepeated = 0;
                    text = LINES.IS_CLOSE[1];
                    saidState = SAID.IS_CLOSE;
                }
                else {
                    if (numRepeated < LINES.IS_NOT_CLOSE[1].length) {
                        text = LINES.IS_NOT_CLOSE[1][numRepeated++];
                    }
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                numRepeated = 0;
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_CLOSE:
            if (face.isPresent) {
                if (face.isClose) {
                    if (face.isLooking) {
                        text = LINES.IS_LOOKING[0];
                        saidState = SAID.IS_LOOKING;
                    }
                    else {
                        text = LINES.IS_NOT_LOOKING[0];
                        saidState = SAID.IS_NOT_LOOKING;
                    }
                }
                else {
                    text = LINES.IS_NOT_CLOSE[2];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_NOT_LOOKING:
            if (face.isPresent) {
                if (face.isClose) {
                    if (face.isLooking) {
                        numRepeated = 0;
                        text = LINES.IS_LOOKING[1];
                        saidState = SAID.IS_LOOKING;
                    }
                    else {
                        if (numRepeated < LINES.IS_NOT_LOOKING[1].length) {
                            text = LINES.IS_NOT_LOOKING[1][numRepeated++];
                        }
                        saidState = SAID.IS_NOT_LOOKING;
                    }
                }
                else {
                    numRepeated = 0;
                    text = LINES.IS_NOT_CLOSE[0];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                numRepeated = 0;
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT;
            }
            break;
        case SAID.IS_LOOKING:
            if (face.isPresent) {
                if (face.isClose) {
                    if (face.isLooking) {
                        if (face.isMouthClosed) {
                            text = LINES.IS_MOUTH_CLOSED[0];
                            saidState = SAID.IS_MOUTH_CLOSED;
                        }
                        else {
                            text = LINES.IS_NOT_MOUTH_CLOSED[0];
                            saidState = SAID.IS_NOT_MOUTH_CLOSED;
                        }
                    }
                    else {
                        text = LINES.IS_NOT_LOOKING[2];
                        saidState = SAID.IS_NOT_LOOKING;
                    }
                }
                else {
                    text = LINES.IS_NOT_CLOSE[0];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT
            }
            break;
        case SAID.IS_NOT_MOUTH_CLOSED:
            if (face.isPresent) {
                if (face.isClose) {
                    if (face.isLooking) {
                        if (face.isMouthClosed) {
                            numRepeated = 0;
                            text = LINES.IS_MOUTH_CLOSED[1];
                            saidState = SAID.IS_MOUTH_CLOSED;
                        }
                        else {
                            if (numRepeated < LINES.IS_NOT_MOUTH_CLOSED[1].length) {
                                text = LINES.IS_NOT_MOUTH_CLOSED[1][numRepeated++];
                            }
                            saidState = SAID.IS_NOT_MOUTH_CLOSED;
                        }
                    }
                    else {
                        numRepeated = 0;
                        text = LINES.IS_NOT_LOOKING[2];
                        saidState = SAID.IS_NOT_LOOKING;
                    }
                }
                else {
                    numRepeated = 0;
                    text = LINES.IS_NOT_CLOSE[2];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                numRepeated = 0;
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT
            }
            break;
        case SAID.IS_MOUTH_CLOSED:
            if (face.isPresent) {
                if (face.isClose) {
                    if (face.isLooking) {
                        if (face.isMouthClosed) {
                            if (numRepeated < LINES.IS_MOUTH_CLOSED[2].length) {
                                text = LINES.IS_MOUTH_CLOSED[2][numRepeated++];
                            }
                            saidState = SAID.IS_MOUTH_CLOSED;
                        }
                        else {
                            numRepeated = 0;
                            text = LINES.IS_NOT_MOUTH_CLOSED[2];
                            saidState = SAID.IS_NOT_MOUTH_CLOSED;
                        }
                    }
                    else {
                        numRepeated = 0;
                        text = LINES.IS_NOT_LOOKING[2];
                        saidState = SAID.IS_NOT_LOOKING;
                    }
                }
                else {
                    numRepeated = 0;
                    text = LINES.IS_NOT_CLOSE[2];
                    saidState = SAID.IS_NOT_CLOSE;
                }
            }
            else {
                numRepeated = 0;
                text = LINES.IS_NOT_PRESENT[2];
                saidState = SAID.IS_NOT_PRESENT
            }
            break;
    }
    message.textContent = text;

    function respeak() {
        const silenceTime = random(minSilenceTime, maxSilenceTime) + numRepeated * 200;
        setTimeout(speak, silenceTime);
    }
    
    if (text) {
        const utterThis = new SpeechSynthesisUtterance(text);
        utterThis.lang = "en-US";
        synth.speak(utterThis);
        function wait() {
            if (!synth.speaking) {
                respeak();
                return;
            }
            setTimeout(wait, 100);
        }
        wait();
    }
    else {
        respeak();
    }
}

async function setupCamera() {
    video = document.getElementById("video");
    const stream = await navigator.mediaDevices.getUserMedia({
        "audio": false,
        "video": {
            facingMode: "user",
            // Only setting the video to a specified size in order to accommodate a
            // point cloud, so on mobile devices accept the default size.
            width: mobile ? undefined : VIDEO_SIZE,
            height: mobile ? undefined : VIDEO_SIZE
        },
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

async function renderPrediction(time) {
    const predictions = await model.estimateFaces(video);
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width, canvas.height);

    if (predictions.length > 0) {
        predictions.forEach(prediction => {

            // The probability of a face being present
            if (prediction.faceInViewConfidence > 0.9) { // only process accurate enough data

                // bounding box
                const boundingBoxLeftX = prediction.boundingBox.topLeft[0][0];
                const boundingBoxRightX = prediction.boundingBox.bottomRight[0][0];
                const boundingBoxTopY = prediction.boundingBox.topLeft[0][1];
                const boundingBoxBottomY = prediction.boundingBox.bottomRight[0][1];
                position.z = lerp(position.z, map(boundingBoxRightX - boundingBoxLeftX, 0, VIDEO_SIZE, 0, 1), lerpAmount);

                // center point
                const boundingBoxCenterX = boundingBoxLeftX + (boundingBoxRightX - boundingBoxLeftX) / 2;
                const boundingBoxCenterY = boundingBoxTopY + (boundingBoxBottomY - boundingBoxTopY) / 2;
                position.x = 1 - (boundingBoxCenterX / VIDEO_SIZE);
                position.y = boundingBoxCenterY / VIDEO_SIZE;

                // silhouette
                const silhouetteLeftZ = prediction.annotations.silhouette[8][2];
                const silhouetteRightZ = prediction.annotations.silhouette[28][2];
                const silhouetteTopZ = prediction.annotations.silhouette[0][2];
                const silhouetteBottomZ = prediction.annotations.silhouette[18][2];
                rotation.y = lerp(rotation.y, map(silhouetteLeftZ - silhouetteRightZ, -100, 100, 0, 1), lerpAmount);
                rotation.x = lerp(rotation.x, map(silhouetteTopZ - silhouetteBottomZ, -100, 100, 0, 1), lerpAmount);

                // lips
                const lipsUpperInnerCenterY = prediction.annotations.lipsUpperInner[5][1];
                const lipsLowerInnerCenterY = prediction.annotations.lipsLowerInner[5][1];
                mouth = lerp(mouth, map(lipsLowerInnerCenterY - lipsUpperInnerCenterY, 0, VIDEO_SIZE / 4, 0, 1) / position.z, lerpAmount);

                // present
                present = true;
            }
            else { // if face is not being present
                present = false;
            }
        });
    }
    face.isPresent = present;
    face.isClose = position.z > 0.45;
    face.isLooking = rotation.y > 0.3 && rotation.y < 0.7 && rotation.x > 0.3 && rotation.x < 0.7;
    face.isMouthClosed = mouth < 0.1;
    requestAnimationFrame(renderPrediction);
};

async function main() {
    await tf.setBackend(state.backend);
    await setupCamera();
    video.play();
    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;
    video.width = videoWidth;
    video.height = videoHeight;
    canvas = document.getElementById("output");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    canvas.style.display = "none"; // hide the canvas
    const canvasWrapper = document.getElementById("canvas-wrapper");
    canvasWrapper.style = `width: ${videoWidth}px; height: ${videoHeight}px`;
    ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    model = await facemesh.load({ maxFaces: state.maxFaces });
    renderPrediction();
    message.textContent = "Click to start";
    isReady = true;
};

window.addEventListener("DOMContentLoaded", async () => {
    message.textContent = "Loading...";
    document.body.addEventListener("click", function () {
        if (isReady) {
            message.textContent = "";
            speak();
            isReady = false;
        }
    });
    main();
});