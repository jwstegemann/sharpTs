/* eslint-disable prettier/prettier */
import sharp from 'sharp';
import opentype from 'opentype.js';
import LineBreaker from 'linebreak';
import fs from "fs";
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const AWS_REGION = "us-east-1";

export const s3 = new S3Client({ region: AWS_REGION});

const FONT_PATH = "fonts"; // process.env.FONT_PATH!;

const fontCache = new Map<string, opentype.Font>();

// Helper function to convert a stream to a buffer
export async function s3ToBuffer(stream) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function getFont(name: string): Promise<opentype.Font> {
  if (!fontCache.has(name)) {
      const key = `${FONT_PATH}/${name}`;

      const { Body } = await s3.send(new GetObjectCommand({
          Bucket: "talemold-models",
          Key: key,
      }));

      // Convert the S3 object stream to a buffer
      const fontBuffer = new Uint8Array(await s3ToBuffer(Body)).buffer;

      fontCache.set(name, opentype.parse(fontBuffer));
  }

  return fontCache.get(name)!;
}

type TextBoxPosition = "NW" | "N" | "NE" | "SW" | "S" | "SE"
type TextBoxWidth = 1 | 2 | 3 | 4

type TextBoxOptions = {
  position: TextBoxPosition,
  width: TextBoxWidth,
  fontName: string,
  fontSize: number,
  lineHeight: number,
  defs?: string,
  styleBox: string,
  styleText: string,
  paddingX?: number,
  paddingY?: number,
  marginY?: number,
  marginX?: number
}

async function renderText(text: string, fontName: string, fontSize: number, lineHeight: number, width: number, left: number, top: number) {
  const breaker = new LineBreaker(text);

  const font = await getFont(fontName);
  const startY = top + fontSize * font.ascender / font.unitsPerEm;
  const paths: string[] = [];

  function addPath(line: string) {
      //    console.log("pushing ", line);
      const path: string = font.getPath(line, left, startY + paths.length * lineHeight, fontSize).toSVG(2).replace('<path', '<path class="text"');
      paths.push(path);

  }

  let lastPosition = 0;
  let lastValidBreak = 0;
  let currentWidth = 0;
  let position: number;

  while (position = breaker.nextBreak()?.position) {
      const substring = text.slice(lastPosition, position); // Using slice instead of substring
      currentWidth = font.getAdvanceWidth(substring, fontSize);

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

  const height = fontSize * (font.ascender / font.unitsPerEm - font.descender / font.unitsPerEm) + (paths.length - 1) * lineHeight;

  return {
      paths,
      height
  };

}


async function buildSvg(text: string, width: number, options: TextBoxOptions) {
  const boxWidth = width - (options.marginX || 0) * 2;
  const textWidth = boxWidth - (options.paddingX || 0) * 2;
  const boxLeft = (options.marginX || 0);
  const boxTop = (options.marginY || 0);
  const textLeft = boxLeft + (options.paddingX || 0);
  const textTop = boxTop + (options.paddingY || 0);

  if (!options.fontName?.length) throw Error("no fontName in TextBoxOptions");
  if (!options.fontSize) throw Error("no fontSize in TextBoxOptions");
  if (!options.lineHeight) options.lineHeight = Math.ceil(options.fontSize * 1.2);

  const { paths, height: textHeight } = await renderText(text, options.fontName, options.fontSize, options.lineHeight, textWidth, textLeft, textTop);
  const boxHeight = textHeight + (options.paddingY || 0) * 2;
  const svgHeight = Math.ceil(boxHeight + (options.marginY || 0) * 2);


  // Debugging geometrics
  // const startY = textTop + options.fontSize * roboto.ascender/roboto.unitsPerEm;
  // const l2 = startY + options.lineHeight;
  // const l3 = l2 + options.lineHeight//roboto.descender/(-16);
  // console.log("" + startY + ", " + l2 + ", " + l3) 

  /* Debugging lines for text box
      <line x1="0" y1="${startY}" x2="${width}" y2="${startY}" stroke="red" />
      <line x1="0" y1="${l2}" x2="${width}" y2="${l2}" stroke="red" />
      <line x1="0" y1="${l3}" x2="${width}" y2="${l3}" stroke="red" />      
      <rect x="${textLeft}" y="${textTop}" width="${textWidth}" height="${textHeight}" stroke="green" fill="none" />
  */

  const svg = `<svg width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
<defs>${options.defs || ""}</defs>
<style>
    .text { ${options.styleText || ""} }
    .box { ${options.styleBox || ""} }
    </style>
      <rect x="${boxLeft}" y="${boxTop}" width="${boxWidth}" height="${boxHeight}" class="box"/>
      ${paths.join()}
  </svg>`;

  return {
      svg: svg,
      height: svgHeight
  };
}

async function renderTextBox(image: sharp.Sharp, text: string, options: TextBoxOptions) {
  const [imageWidth, imageHeight] = await image.metadata().then(m => [m.width!, m.height!]);
  console.log("size." , imageWidth," x ", imageHeight);

  const width = Math.trunc(imageWidth / options.width);
  console.log("width: ", width);

  const { svg, height } = await buildSvg(text, width, options);

  let top, left;

  switch(options.position) {
    case "NW": top = 0; left = 0; break;
    case "N": top = 0; left = Math.trunc((imageWidth - width) / 2); break;
    case "NE": top = 0; left = (imageWidth - width); break;
    case "SW": top = imageHeight - height; left = 0; break;
    case "S": top = imageHeight - height; left = Math.trunc((imageWidth - width) / 2); break;
    case "SE": top = imageHeight - height; left = (imageWidth - width); break;
  }
 
  return image.composite([{
    input: Buffer.from(svg),
    top: top,
    left: left,
  }]).toBuffer();
}


(async () => {

  const image = sharp("/Users/tiberius/ai/img/bst_4/fireman_gross.png");
  //const image = await sharp("/Users/tiberius/ai/img/bst_4/tina_arielle.png");
  
  const buffer = renderTextBox(image, "Dies ist ein neuer Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überaupt etwas passgjyiert...", {
    position: "SE",
    width: 2,
//    fontName: "Roboto/Roboto-Regular.ttf",
    fontName: "KMKDSP__.ttf",
    fontSize: 96,
    lineHeight: 124,
    defs: `
      <radialGradient id="0" cx="50%" cy="50%" r="50%" >
        <stop offset="0%" style="stop-color:rgb(245,230,147);stop-opacity:1.00" />
        <stop offset="40%" style="stop-color:rgb(255,233,90);stop-opacity:1.00" />
        <stop offset="80%" style="stop-color:rgb(227,204,92);stop-opacity:1.00" />
      </radialGradient> 
    `.trim(),
    styleBox: "stroke: #000000; filter: drop-shadow( 10px 10px 8px rgba(0, 0, 0, .5)); fill: url(#0); rx:10; ry:10;",
    styleText: "fill: black",
    paddingX: 48,
    paddingY: 48,
    marginX: 64,
    marginY: 64
  });
  
  
  // renderTextBox("Dies ist ein Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überaupt etwas passgjyiert...", {
  //   width: 500,
  //   fontName: "Roboto/Roboto-Regular.ttf",
  //   fontSize: 20,
  //   lineHeight: 24,
  //   styleBox: "stroke: #000000; filter: drop-shadow( 3px 3px 2px rgba(0, 0, 0, .5)); fill: url(#0); rx:3; ry:3;",
  //   styleText: "fill: black",
  //   paddingX: 15,
  //   paddingY: 15,
  //   marginX: 8,
  //   marginY: 8
  // });
  
  try {
    fs.writeFileSync('test.png', await buffer);
    console.log('The file has been saved!');
  } catch (err) {
    console.error('Error writing file:', err);
  }

})();
