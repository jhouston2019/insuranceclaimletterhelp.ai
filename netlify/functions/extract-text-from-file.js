/**
 * TEXT EXTRACTION ENGINE
 * 
 * Extracts text from PDF and image files
 * - PDF: Uses pdf-parse
 * - Images: Uses Tesseract.js OCR
 * 
 * NO PLACEHOLDERS - PRODUCTION READY
 */

const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const { getSupabaseAdmin } = require('./_supabase');

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
    const { filePath, fileType, documentId } = JSON.parse(event.body || '{}');
    
    if (!filePath) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'File path is required' })
      };
    }

    console.log('Extracting text from:', filePath, 'Type:', fileType);

    // Download file from Supabase Storage
    const supabase = getSupabaseAdmin();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('claim-letters')
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    let extractedText = '';

    // Extract based on file type
    if (fileType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
      // PDF extraction
      console.log('Extracting from PDF...');
      const buffer = await fileData.arrayBuffer();
      const pdfData = await pdfParse(Buffer.from(buffer));
      extractedText = pdfData.text;
      
    } else if (fileType?.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(filePath)) {
      // Image OCR extraction
      console.log('Extracting from image using OCR...');
      const buffer = await fileData.arrayBuffer();
      const result = await Tesseract.recognize(
        Buffer.from(buffer),
        'eng',
        {
          logger: m => console.log(m)
        }
      );
      extractedText = result.data.text;
      
    } else {
      throw new Error('Unsupported file type. Only PDF and images (JPG, PNG) are supported.');
    }

    // Validate extracted text
    if (!extractedText || extractedText.trim().length < 50) {
      throw new Error('Could not extract sufficient text from file. The file may be empty, corrupted, or contain only images. Minimum 50 characters required.');
    }

    console.log(`Extracted ${extractedText.length} characters`);

    // Update database with extracted text
    if (documentId) {
      const { error: updateError } = await supabase
        .from('claim_letters')
        .update({
          extracted_text: extractedText,
          letter_text: extractedText,
          status: 'extracted'
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Failed to update document:', updateError);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        extractedText,
        characterCount: extractedText.length,
        documentId
      })
    };

  } catch (error) {
    console.error('Text extraction error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Text extraction failed',
        details: error.message
      })
    };
  }
};
