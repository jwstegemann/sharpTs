/* eslint-disable prettier/prettier */
import sharp from 'sharp';
import opentype from 'opentype.js';
import LineBreaker from 'linebreak';

const roboto = opentype.loadSync('Roboto/Roboto-Regular.ttf');
//const path = roboto.getPath("Dies ist ein ziemlich langer Text. Ich will nur mal sehen, ob das auch für eine ganze Textzeile reichen würde.", 50,80,80).toSVG().replace('<path', '<path class="test"');

function renderText(text: string, fontSize: number, lineHeight: number, width: number, left: number, top: number) {
  const breaker = new LineBreaker(text);
  let lastBreak = 0;
  let lastLine = 0;
  let bk;

  const startY = top + fontSize - 16 * roboto.ascender/roboto.unitsPerEm;

  console.log("starty", startY)

  const paths: string[] = [];
  let oldline = "";

  while (bk = breaker.nextBreak()) {
    // get the string between the last break and this one
    const currentLine = text.slice(lastLine, bk.position);
    console.log(currentLine);
    //TODO: choose font

    if (roboto.getAdvanceWidth(currentLine, fontSize) > width) {
      console.log("*** pushing ", oldline);
      const path: string = roboto.getPath(oldline, left, startY + paths.length  * lineHeight, fontSize).toSVG(2).replace('<path', '<path class="text"');
      paths.push(path);
      oldline = currentLine;
      lastLine = lastBreak;
    }
    else {
      oldline = currentLine;
    }

    lastBreak = bk.position;
  }
  const path: string = roboto.getPath(oldline, left, startY + paths.length  * lineHeight, fontSize).toSVG(2).replace('<path', '<path class="text"');
  paths.push(path);


  const height = startY + (paths.length-1) * lineHeight;

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
  marginVertical: number,
  marginHorizontal: number
}


function buildSvg(text: string, options: TextFieldOptions) {
  const boxWidth = options.width - 20;
  const textWidth = boxWidth - options.marginHorizontal * 2;
  const textLeft = 10 + options.marginHorizontal;
  const textTop = 10 + options.marginVertical;

  const {paths, height : textHeight} = renderText(text, options.fontSize, options.lineHeight, textWidth, textLeft, textTop);
  const boxHeight = textHeight + options.marginVertical * 2;
  const svgHeight = boxHeight + 20;

  return `<svg width="${options.width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .text { ${options.styleText} }
      .box { ${options.styleBox} }
      .tb {
        stroke: #00AA00; 
        fill: none;
      }
      </style>
      <rect x="${options.marginHorizontal}" y="${options.marginVertical}" width="${boxWidth}" height="${boxHeight}" class="box"/>
      <rect x="${textLeft}" y="${textTop}" width="${textWidth}" height="${textHeight}" class="tb" />
      ${paths.join()}
    </svg>`
}


async function renderTextBox(text: string, options: TextFieldOptions) {
  const svg = buildSvg(text, options);

  const image = await sharp("/Users/tiberius/ai/img/bst_4/fireman_gross.png");

  image.composite([{
    input: Buffer.from(svg),
    top: 20,
    left: 20,
  }])
    .toFile('./test.png');
}

renderTextBox("Dies ist ein Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überhaupt etwas passiert...", {
  width: 800,
  fontSize: 80,
  lineHeight: 96,
  styleBox: "stroke: #000000; filter: drop-shadow( 5px 5px 5px rgba(0, 0, 0, .5)); fill: #dddddd; rx:5; ry:5;",
  styleText: "fill: black",
  marginHorizontal: 10,
  marginVertical: 10
});


// async function getMetadata() {
//   var lorem = 'Dies ist ein Test. (Ich bin mal gespannt, wie der umgebrochen wird.) Und ob überhaupt etwas passiert...';
//   var breaker = new LineBreaker(lorem);
//   var last = 0;
//   var lastLine = 0;
//   var bk;


//   const lines = []
//   let oldline

//   while (bk = breaker.nextBreak()) {
//     // get the string between the last break and this one
//     var currentLine = lorem.slice(lastLine, bk.position);
//     console.log(currentLine);
//     const width = roboto.getAdvanceWidth(currentLine, 80);
//     console.log(width);

//     if (width > 760) {
//       console.log("*** pushing ", oldline)
//       lines.push(oldline.trim())
//       oldline = currentLine;
//       lastLine = last
//     }
//     else {
//       oldline = currentLine
//     }

//     last = bk.position;
//   }
//   if (oldline.length) lines.push(oldline)


//   const lineHeight = 100

//   const paths = []

//   for (let i = 0; i < lines.length; i++) {
//     const path = roboto.getPath(lines[i], 20, (i+1) * lineHeight, 80).toSVG().replace('<path', '<path class="test"');
//     paths.push(path)
//   }

//   const height = (lines.length * lineHeight + 40).toString();

//   console.log(height);


//   const metadata = 
// }

// getMetadata();