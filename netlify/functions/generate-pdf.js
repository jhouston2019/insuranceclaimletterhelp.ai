const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { text, fileName = 'dispute-letter.pdf', certifiedMailHeader } = body;

    const headerBlock = certifiedMailHeader
      ? 'SENT VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED\n\n'
      : '';
    const fullText = headerBlock + (text || '');

    if (!fullText.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No text provided' })
      };
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontSize = 11;
    const lineHeight = fontSize * 1.5;
    const margin = 72;

    const addPage = () => {
      const p = pdfDoc.addPage([612, 792]);
      return { page: p, y: p.getHeight() - margin };
    };

    let { page, y } = addPage();
    const maxWidth = 612 - margin * 2;

    const rawLines = fullText.split('\n');
    const wrappedLines = [];

    for (const raw of rawLines) {
      if (raw.trim() === '') {
        wrappedLines.push('');
        continue;
      }
      const words = raw.split(' ');
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (font.widthOfTextAtSize(test, fontSize) <= maxWidth) {
          current = test;
        } else {
          if (current) wrappedLines.push(current);
          current = word;
        }
      }
      if (current) wrappedLines.push(current);
    }

    for (const line of wrappedLines) {
      if (y < margin + lineHeight) {
        const next = addPage();
        page = next.page;
        y = next.y;
      }
      if (line.trim()) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        });
      }
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Access-Control-Allow-Origin': '*'
      },
      body: Buffer.from(pdfBytes).toString('base64'),
      isBase64Encoded: true
    };

  } catch (err) {
    console.error('generate-pdf error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Failed to generate PDF', details: err.message })
    };
  }
};
