import { UserData } from "./UserData.js";
import { Controls } from "./Controls.js";
import { Point } from "./Point.js";
import { DrawnLine } from "./DrawnLine.js";
import { PenOptions } from "./PenOptions.js";
import * as utils from "./utils.js";

const userData = new UserData();
userData.loadFromLocalStorage();

const controls = new Controls(userData);

let rewriterTraceContext = controls.rewriterTraceCanvas.getContext('2d');
let rewriterLinesContext = controls.rewriterLinesCanvas.getContext('2d');
rewriterLinesContext.imageSmoothingEnabled = false
let rewriterContext = controls.rewriterCanvas.getContext('2d');
            
rewriterContext.lineCap = "round";
let rewriterMaskContext = controls.rewriterMaskCanvas.getContext('2d');

// Colours
await drawStoredLines(rewriterContext, true, false);

//

let penDown = false;

let isRewriting = false;

let previousDrawPosition = new Point(0, 0);

//
let currentLine = [];
//

function resetcanvasWriter()
{
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    rewriterTraceContext.clearRect(0, 0, controls.rewriterTraceCanvas.width, controls.rewriterTraceCanvas.height);
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    rewriterContext.strokeStyle = userData.userSettings.selectedPenColour;
    userData.deletedLines = [];
}

// TODO move to controls

controls.traceButton.onclick = async () => {
    userData.userSettings.isTraceOn = !userData.userSettings.isTraceOn;

    controls.traceButton.classList.remove("option-selected");
    
    const rewriterTraceContext = controls.rewriterTraceCanvas.getContext('2d');
    rewriterTraceContext.clearRect(0, 0, controls.rewriterTraceCanvas.width, controls.rewriterTraceCanvas.height)
    
    if (userData.userSettings.isTraceOn) {
        controls.traceButton.classList.add("option-selected");
        await drawStoredLines(rewriterTraceContext, true, true); 
    }
}

// Bottom controls

controls.undoButton.onclick = async function()
{
    if (!isRewriting && userData.deletedLines.length < 100 && userData.storedLines.length > 0) {
        userData.deletedLines.push(userData.storedLines.pop());
        rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
        await drawStoredLines(rewriterContext, true, false);
    }
}

controls.redoButton.onclick = async function()
{
    if (!isRewriting && userData.deletedLines.length != 0) {
        userData.storedLines.push(userData.deletedLines.pop());    
        rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
        await drawStoredLines(rewriterContext, true, false);
    }
}
let controller = new AbortController();
let signal = controller.signal;

const playImageSrc = "images/playIcon.svg";
const stopImageSrc = "images/stopIcon.svg";
const rewriteButtonImage = controls.rewriteButton.getElementsByTagName('img')[0];

controls.resetButton.onclick = function() {
    controller?.abort();
    resetcanvasWriter();
    userData.storedLines = [];
}

controls.rewriteButton.onclick = async () => {    

    controller?.abort();
    controller = new AbortController();
    signal = controller.signal;
    await rewrite(signal);
}

async function rewrite(signal = new AbortSignal()) {
    
    if (signal.aborted || isRewriting || !userData.storedLines.length) {
        rewriteButtonImage.src = playImageSrc;
        return;
    }

    rewriteButtonImage.src = stopImageSrc;
    if (typeof gtag === "function") {
        gtag('event', 'activate_rewrite', {
            'loop_on': userData.userSettings.isLoopOn,
            'trace_on': userData.userSettings.isTraceOn,
            'selected_background': userData.userSettings.selectedBackground,
            'selected_page_colour': userData.userSettings.selectedPageColour,
            'selected_pen_image': userData.userSettings.selectedPenImage,
            'write_speed_multiplier': userData.userSettings.rewriteSpeed,
            'zoom': userData.userSettings.zoomLevel
        });
    }

    isRewriting = true;
    
    do 
    {        
        rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
        rewriterTraceContext.clearRect(0, 0, controls.rewriterTraceCanvas.width, controls.rewriterTraceCanvas.height);

        if (userData.userSettings.isTraceOn)
        {
            await drawStoredLines(rewriterTraceContext, true, true, signal);
        }

        await drawStoredLines(rewriterContext, false, false, signal);

        rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
        
        if (signal.aborted) {
            break;
        }

        if (userData.userSettings.isLoopOn)
        {
            await new Promise(r => setTimeout(r, 1000));
        }
    } while (userData.userSettings.isLoopOn & isRewriting);

    isRewriting = false;
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    rewriterTraceContext.clearRect(0, 0, controls.rewriterTraceCanvas.width, controls.rewriterTraceCanvas.height);
    await drawStoredLines(rewriterContext, true, false, undefined);

    rewriteButtonImage.src = playImageSrc;    
}

async function drawStoredLines(ctx, instantDraw = false, traceDraw = false, abortSignal = undefined) {

    ctx.lineCap = "round";

    for (let i = 0; i < userData.storedLines.length; i++) {
        if (abortSignal?.aborted) {
            return;
        }

        for (let j = 0; j < userData.storedLines[i].length; j++) {
            
            if (abortSignal?.aborted) {
                return;
            }
            
            ctx.lineWidth = userData.storedLines[i][j].penOptions.width;

            const baseColour = userData.storedLines[i][j].penOptions.colour;
            const traceColour = 'rgb(200, 200, 200)';
            if (traceDraw) {
                ctx.strokeStyle = traceColour;
            }
            else {
                ctx.strokeStyle = baseColour;
            }

            ctx.beginPath();        
            ctx.moveTo(userData.storedLines[i][j].start.x, userData.storedLines[i][j].start.y);
            ctx.lineTo(userData.storedLines[i][j].end.x, userData.storedLines[i][j].end.y);
            
            if (!instantDraw) {
                rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
                
                let penImage = utils.PenEnumToImage(userData.userSettings.selectedPenImage);
                if (penImage) {
                    rewriterMaskContext.drawImage(penImage, userData.storedLines[i][j].end.x, userData.storedLines[i][j].end.y - penImage.height);
                }
            }
            ctx.stroke();   
    
            if (!instantDraw) {
                await new Promise(r => setTimeout(r, 50 / userData.userSettings.rewriteSpeed));
            }

            if (abortSignal?.aborted) {
                return;
            }
        }

        if (!instantDraw) {
            await new Promise(r => setTimeout(r, 500 / userData.userSettings.rewriteSpeed));
        }
    }
}

controls.rewriterCanvas.addEventListener('touchstart', event => 
{
    event = event.touches[0];
    drawStart(event);
});

controls.rewriterCanvas.addEventListener('mousedown', event => 
{   
    drawStart(event);
});

function drawStart(event) {
    if (!isRewriting)
        {        
            let bound = controls.rewriterCanvas.getBoundingClientRect();
            
            const mousePos = new Point(
                event.clientX - bound.left - controls.rewriterCanvas.clientLeft, 
                event.clientY - bound.top - controls.rewriterCanvas.clientTop
            );
    
            if (mousePos.x > 0 && mousePos.x < controls.rewriterCanvas.width && mousePos.y > 0 && mousePos.y < controls.rewriterCanvas.height)
            {
                userData.deletedLines = [];
    
                rewriterContext.strokeStyle = userData.userSettings.selectedPenColour;
                rewriterContext.beginPath();        
                rewriterContext.lineWidth = userData.userSettings.selectedPenWidth;
    
                rewriterContext.moveTo(mousePos.x, mousePos.y);
                rewriterContext.lineTo(mousePos.x, mousePos.y);
                rewriterContext.stroke();
    
                currentLine.push(new DrawnLine(mousePos, mousePos, new PenOptions(userData.userSettings.selectedPenColour, userData.userSettings.selectedPenWidth)));
    
                previousDrawPosition = mousePos;
    
                penDown = true;
            }
        }
}

document.addEventListener('touchend', () => 
{
    drawEnd();
});

document.addEventListener('mouseup', () => 
{
    drawEnd();
});

function drawEnd() {
    if (!penDown) {
        return;
    }

    userData.storedLines.push(currentLine.slice());
    currentLine = [];
    penDown = false;

    userData.saveToLocalStorage();    
}

document.addEventListener('touchmove', event => {
    event = event.touches[0];

    if (penDown) {
        drawMove(event);
    }
});

document.addEventListener('mousemove', event => {
    if (penDown) {
        drawMove(event);
    }
});

function drawMove(event) {
    rewriterContext.strokeStyle = userData.userSettings.selectedPenColour;
    rewriterContext.beginPath();        
    rewriterContext.lineWidth = userData.userSettings.selectedPenWidth;

    rewriterContext.moveTo(previousDrawPosition.x, previousDrawPosition.y);
    let bound = controls.rewriterCanvas.getBoundingClientRect();

    const mousePos = new Point(
        event.clientX - bound.left - controls.rewriterCanvas.clientLeft,
        event.clientY - bound.top - controls.rewriterCanvas.clientTop
    );

    currentLine.push(new DrawnLine(previousDrawPosition, mousePos, new PenOptions(userData.userSettings.selectedPenColour, userData.userSettings.selectedPenWidth)));

    rewriterContext.lineTo(mousePos.x, mousePos.y);
    rewriterContext.stroke();

    previousDrawPosition = mousePos;
};
