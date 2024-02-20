/* eslint-disable prettier/prettier */
import sharp from 'sharp';
import opentype from 'opentype.js';
import LineBreaker from 'linebreak';

// const roboto = opentype.loadSync('./KMKDSP__.ttf');
const roboto = opentype.loadSync('./Roboto/Roboto-Regular.ttf');


function renderText(text: string, fontSize: number, lineHeight: number, width: number, left: number, top: number) {
  const breaker = new LineBreaker(text);

  const startY = top + fontSize * roboto.ascender/roboto.unitsPerEm;
  const paths: string[] = [];

  function addPath(line: string) {
//    console.log("pushing ", line);
    const path: string = roboto.getPath(line, left, startY + paths.length  * lineHeight, fontSize).toSVG(2).replace('<path', '<path class="text"');
    paths.push(path);

  }

  let lastPosition = 0;
  let lastValidBreak = 0;
  let currentWidth = 0;
  let position: number;

  while (position = breaker.nextBreak()?.position) {
      const substring = text.slice(lastPosition, position); // Using slice instead of substring
      currentWidth = roboto.getAdvanceWidth(substring, fontSize);

      if (currentWidth > width) {
          // If we've exceeded the max width, split at the last valid break point
          // and reset the lastPosition and currentWidth to start from the last valid break
          if (lastValidBreak === lastPosition) { // Handle case where a single segment exceeds maxWidth
              addPath(substring); // Add the oversized segment as is or handle differently
              lastPosition = position; // Move past this segment
          } else {
              addPath(text.slice(lastPosition, lastValidBreak));
              lastPosition = lastValidBreak; // Start next part from the last valid break
              continue; // Skip the increment to reevaluate the width from the last valid break
          }
      }

      lastValidBreak = position; // Update last valid break to current position
  }

  // Add the last part if there's any remaining text
  if (lastPosition < text.length) {
      addPath(text.slice(lastPosition));
  }

  console.log(paths.length);

  const height =  fontSize * (roboto.ascender/roboto.unitsPerEm -  roboto.descender/roboto.unitsPerEm) + (paths.length-1) * lineHeight;

  return {
    paths,
    height
  };

}


type TextFieldOptions = {
  width: number,
  fontSize: number,
  lineHeight: number,
  styleBox: string,
  styleText: string,
  paddingX?: number,
  paddingY?: number,
  marginY: number,
  marginX: number
}


function buildSvg(text: string, options: TextFieldOptions) {

  console.log("options.paddingX", options.paddingX);
  console.log("options.marginX", options.marginX);

  const boxWidth = options.width - (options.marginX || 0)*2;
  const textWidth = boxWidth - (options.paddingX || 0) * 2;
  const boxLeft = (options.marginX || 0);
  const boxTop = (options.marginY || 0);
  const textLeft = boxLeft + (options.paddingX || 0);
  const textTop = boxTop + (options.paddingY || 0);

  const {paths, height : textHeight} = renderText(text, options.fontSize, options.lineHeight, textWidth, textLeft, textTop);
  const boxHeight = textHeight + (options.paddingY || 0) * 2;
  const svgHeight = boxHeight + (options.marginY || 0) *2;


  // Debugging geometrics
  // const startY = textTop + options.fontSize * roboto.ascender/roboto.unitsPerEm;
  // const l2 = startY + options.lineHeight;
  // const l3 = l2 + options.lineHeight//roboto.descender/(-16);
  // console.log("" + startY + ", " + l2 + ", " + l3) 

  /* Debugging lines for text box
      <line x1="0" y1="${startY}" x2="${options.width}" y2="${startY}" stroke="red" />
      <line x1="0" y1="${l2}" x2="${options.width}" y2="${l2}" stroke="red" />
      <line x1="0" y1="${l3}" x2="${options.width}" y2="${l3}" stroke="red" />      
      <rect x="${textLeft}" y="${textTop}" width="${textWidth}" height="${textHeight}" stroke="green" fill="none" />
  */

  return `<svg width="${options.width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
  <radialGradient id="0" cx="50%" cy="50%" r="50%" >
    <stop offset="0%" style="stop-color:rgb(245,230,147);stop-opacity:1.00" />
    <stop offset="40%" style="stop-color:rgb(255,233,90);stop-opacity:1.00" />
    <stop offset="80%" style="stop-color:rgb(227,204,92);stop-opacity:1.00" />
  </radialGradient>
  </defs>
  <style>
      .text { ${options.styleText} }
      .box { ${options.styleBox} }
      </style>
        <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" class="box"/>
        ${paths.join()}
    </svg>`;
}


async function renderTextBox(text: string, options: TextFieldOptions) {
  const svg = buildSvg(text, options);

  const image = await sharp("/Users/tiberius/ai/img/bst_4/fireman_gross.png");
  //const image = await sharp("/Users/tiberius/ai/img/bst_4/tina_arielle.png");

  image.composite([{
    input: Buffer.from(svg),
    top: 20,
    left: 20,
  }])
    .toFile('./test.png');
}

renderTextBox("Dies ist ein Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überaupt etwas passgjyiert...", {
  width: 2000,
  fontSize: 80,
  lineHeight: 96,
  styleBox: "stroke: #000000; filter: drop-shadow( 10px 10px 8px rgba(0, 0, 0, .5)); fill: url(#0); rx:10; ry:10;",
  styleText: "fill: black",
  paddingX: 48,
  paddingY: 48,
  marginX: 10,
  marginY: 10
});


// renderTextBox("Dies ist ein Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überaupt etwas passgjyiert...", {
//   width: 500,
//   fontSize: 20,
//   lineHeight: 24,
//   styleBox: "stroke: #000000; filter: drop-shadow( 3px 3px 2px rgba(0, 0, 0, .5)); fill: url(#0); rx:3; ry:3;",
//   styleText: "fill: black",
//   paddingX: 15,
//   paddingY: 15,
//   marginX: 3,
//   marginY: 3
// });
