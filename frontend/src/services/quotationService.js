import jsPDF from 'jspdf';

// Function to convert number to words
const numberToWords = (num) => {
  const ones = [
    '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
    'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
    'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
  ];
  
  const tens = [
    '', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'
  ];
  
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION'];
  
  if (num === 0) return 'ZERO';
  
  const convertChunk = (chunk) => {
    let result = '';
    
    if (chunk >= 100) {
      result += ones[Math.floor(chunk / 100)] + ' HUNDRED ';
      chunk %= 100;
    }
    
    if (chunk >= 20) {
      result += tens[Math.floor(chunk / 10)] + ' ';
      chunk %= 10;
    }
    
    if (chunk > 0) {
      result += ones[chunk] + ' ';
    }
    
    return result.trim();
  };
  
  let result = '';
  let scaleIndex = 0;
  
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk !== 0) {
      const chunkWords = convertChunk(chunk);
      if (scaleIndex > 0) {
        result = chunkWords + ' ' + scales[scaleIndex] + ' ' + result;
      } else {
        result = chunkWords + ' ' + result;
      }
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }
  
  return result.trim() + ' RUPEES ONLY';
};

// Function to format number with comma separators
const formatNumberWithCommas = (num) => {
  if (typeof num !== 'number') {
    num = parseFloat(num) || 0;
  }
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const normalizePdfDescriptionText = (text = '') => {
  return String(text)
    .replace(/\u2267/g, '>=')
    .replace(/\u2266/g, '<=');
};

// Function to load image as base64
const loadImageAsBase64 = (imagePath) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = this.naturalWidth;
      canvas.height = this.naturalHeight;
      ctx.drawImage(this, 0, 0);
      try {
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = imagePath;
  });
};

export const generateQuotationPDF = async (quotationData) => {
  try {
    // Create new PDF document
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 30;
    
    let yPosition = 20;
    let currentPage = 1;
    
    // Generate unique quotation ID
    const quotationId = `QT-${Date.now()}`;
    
    // Load logo
    let logoBase64 = null;
    try {
      logoBase64 = await loadImageAsBase64('/images/logo1.png');
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
    
    // Function to add header to each page
    const addHeader = () => {
      // Add logo and watermark
      if (logoBase64) {
        const logoSize = 40;
        doc.addImage(logoBase64, 'PNG', 15, 10, logoSize, logoSize);
        
        const watermarkSize = 150;
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = (pageHeight - watermarkSize) / 2;
        
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.15 }));
        doc.addImage(logoBase64, 'PNG', watermarkX, watermarkY, watermarkSize, watermarkSize);
        doc.restoreGraphicsState();
      }
      
      // Company details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('P.E. INDUSTRIAL AUTOMATION (PVT). LTD', pageWidth - 15, 15, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('194/20/12, Thalgahahena Road, Kesbewa,', pageWidth - 15, 22, { align: 'right' });
      doc.text('Piliyandala, Sri Lanka.', pageWidth - 15, 27, { align: 'right' });
      doc.text('+94717694334', pageWidth - 15, 32, { align: 'right' });
      doc.text('+94763995483', pageWidth - 15, 37, { align: 'right' });
      
      if (currentPage > 1) {
        doc.setFontSize(8);
        doc.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    };
    
    // Function to check if we need a new page
    const checkNewPage = (requiredSpace = 15) => {
      if (yPosition + requiredSpace > pageHeight - marginBottom) {
        doc.addPage();
        currentPage++;
        addHeader();
        yPosition = 55;
        return true;
      }
      return false;
    };
    
    // Add header to first page
    addHeader();
    
    yPosition = 55;
    
    // Document title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTATION FOR MACHINERY', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Quotation details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const currentDate = new Date();
    const quotationDate = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()}`;
    const quotationTime = currentDate.toLocaleTimeString();
    
    doc.text(`To: ${quotationData.customerInfo.name}`, 15, yPosition);
    doc.text(`Quotation Number: ${quotationId}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;
    
    // Add customer address if exists
    if (quotationData.customerInfo.address && quotationData.customerInfo.address.trim()) {
      doc.setFontSize(10);
      doc.text(`Address: ${quotationData.customerInfo.address}`, 15, yPosition);
      yPosition += 6;
      doc.setFontSize(10);
    }
    
    doc.text(`Date: ${quotationDate}`, 15, yPosition);
    yPosition += 15;
    
    // Items section - Table format
    checkNewPage(80);
    
    // Table configuration
    const tableStartX = 15;
    const tableWidth = pageWidth - 30;

    // Make other column widths fixed, and compute last column to fill remaining space
    const colWidths = {
      no: 10,
      item: 75,
      qty: 20,
      unitCost: 35,
      totalCost: null // compute below
    };

    // Compute totalCost so all columns exactly fill tableWidth
    const usedWidth = colWidths.no + colWidths.item + colWidths.qty + colWidths.unitCost;
    colWidths.totalCost = tableWidth - usedWidth;

    // safety: if computed width is negative or too small, clamp to some min
    if (colWidths.totalCost < 30) {
      // adjust item column to make room if needed
      colWidths.item = Math.max(40, colWidths.item - (30 - colWidths.totalCost));
      colWidths.totalCost = tableWidth - (colWidths.no + colWidths.item + colWidths.qty + colWidths.unitCost);
    }

    let xPos = tableStartX;
    const headerHeight = 10;

    // Header background
    doc.setDrawColor(0,0,0);
    doc.setFillColor(255,255,255);
    doc.rect(tableStartX, yPosition, tableWidth, headerHeight, 'FD');

    // Header text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    // NO. column
    doc.text('NO.', xPos + colWidths.no / 2, yPosition + 6, { align: 'center' });
    xPos += colWidths.no;
    doc.line(xPos, yPosition, xPos, yPosition + headerHeight);

    // ITEM column
    doc.text('ITEM', xPos + colWidths.item / 2, yPosition + 6, { align: 'center' });
    xPos += colWidths.item;
    doc.line(xPos, yPosition, xPos, yPosition + headerHeight);

    // QTY column
    doc.text('QTY', xPos + colWidths.qty / 2, yPosition + 6, { align: 'center' });
    xPos += colWidths.qty;
    doc.line(xPos, yPosition, xPos, yPosition + headerHeight);

    // UNIT COST column
    doc.text('UNIT COST', xPos + colWidths.unitCost / 2, yPosition + 4, { align: 'center' });
    doc.setFontSize(9);
    doc.text('(LKR)', xPos + colWidths.unitCost / 2, yPosition + 8, { align: 'center' });
    doc.setFontSize(10);
    xPos += colWidths.unitCost;
    doc.line(xPos, yPosition, xPos, yPosition + headerHeight);

    // TOTAL COST column (computed width)
    doc.text('TOTAL COST', xPos + colWidths.totalCost / 2, yPosition + 4, { align: 'center' });
    doc.setFontSize(9);
    doc.text('(LKR)', xPos + colWidths.totalCost / 2, yPosition + 8, { align: 'center' });

    // draw the rightmost border of the table explicitly (important)
    doc.line(tableStartX + tableWidth, yPosition, tableStartX + tableWidth, yPosition + headerHeight);

    yPosition += headerHeight;

    
    // Draw table rows
    doc.setFont('helvetica', 'normal');
    let itemNumber = 1;
    
    for (const item of quotationData.items) {
      const itemTotal = item.unitPrice * item.quantity;
      const itemDescription = normalizePdfDescriptionText(item.extraDescription || '');
      
      // Calculate row height based on content
      const imageSize = 40;
      let textHeight = 20;
      
      // Calculate description height
      if (itemDescription.trim()) {
        const descLines = doc.splitTextToSize(itemDescription, colWidths.item - 6);
        textHeight = Math.max(textHeight, descLines.length * 4 + 20);
      }
      
      // Add image height below text if image exists
      const rowHeight = item.images && item.images.length > 0 ? textHeight + imageSize + 5 : textHeight;
      
      // Check if new page needed
      if (yPosition + rowHeight > pageHeight - marginBottom) {
        doc.addPage();
        currentPage++;
        addHeader();
        yPosition = 55;
        
        // Redraw table header on new page
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(250, 250, 250);
        doc.rect(tableStartX, yPosition, tableWidth, headerHeight, 'FD');
        
        xPos = tableStartX;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('NO.', xPos + colWidths.no / 2, yPosition + 6, { align: 'center' });
        xPos += colWidths.no;
        doc.line(xPos, yPosition, xPos, yPosition + headerHeight);
        doc.text('ITEM', xPos + colWidths.item / 2, yPosition + 6, { align: 'center' });
        xPos += colWidths.item;
        doc.line(xPos, yPosition, xPos, yPosition + headerHeight);
        doc.text('QTY', xPos + colWidths.qty / 2, yPosition + 6, { align: 'center' });
        xPos += colWidths.qty;
        doc.line(xPos, yPosition, xPos, yPosition + headerHeight);
        doc.text('UNIT COST', xPos + colWidths.unitCost / 2, yPosition + 4, { align: 'center' });
        doc.setFontSize(9);
        doc.text('(LKR)', xPos + colWidths.unitCost / 2, yPosition + 8, { align: 'center' });
        doc.setFontSize(10);
        xPos += colWidths.unitCost;
        doc.line(xPos, yPosition, xPos, yPosition + headerHeight);
        doc.text('TOTAL COST', xPos + colWidths.totalCost / 2, yPosition + 4, { align: 'center' });
        doc.setFontSize(9);
        doc.text('(LKR)', xPos + colWidths.totalCost / 2, yPosition + 8, { align: 'center' });
        
        yPosition += headerHeight;
        doc.setFont('helvetica', 'normal');
      }
      
      const rowStartY = yPosition;
      
      // Draw row borders
      doc.setDrawColor(0, 0, 0);
      doc.rect(tableStartX, yPosition, tableWidth, rowHeight);
      
      xPos = tableStartX;
      
      // NO. column
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${itemNumber}.0`, xPos + colWidths.no / 2, yPosition + 8, { align: 'center' });
      doc.line(xPos + colWidths.no, yPosition, xPos + colWidths.no, yPosition + rowHeight);
      xPos += colWidths.no;
      
      // ITEM column
      doc.setFont('helvetica', 'normal');
      const itemContentX = xPos + 3;
      let itemTextY = yPosition + 5;
      
      // Item name
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const itemNameLines = doc.splitTextToSize(item.name, colWidths.item - 6);
      itemNameLines.forEach((line, idx) => {
        doc.text(line, itemContentX, itemTextY + (idx * 5));
      });
      itemTextY += itemNameLines.length * 5 + 1;
      
      // Item ID
      if (item.itemId) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`ID: ${item.itemId}`, itemContentX, itemTextY);
        itemTextY += 4;
      }
      
      // Item specifications/description
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      
      if (itemDescription.trim()) {
        const descLines = doc.splitTextToSize(itemDescription, colWidths.item - 6);
        descLines.forEach((line, idx) => {
          doc.text(line, itemContentX, itemTextY + (idx * 3.5));
        });
        itemTextY += descLines.length * 3.5 + 2;
      }
      
      // Add image below text if available (only first image)
      if (item.images && item.images.length > 0) {
        try {
          doc.addImage(item.images[0].data, 'JPEG', itemContentX, itemTextY, imageSize, imageSize);
        } catch (err) {
          console.warn('Error adding image:', err);
        }
      }
      
      doc.line(xPos + colWidths.item, yPosition, xPos + colWidths.item, yPosition + rowHeight);
      xPos += colWidths.item;
      
      // QTY column
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.quantity} NOS`, xPos + colWidths.qty / 2, yPosition + rowHeight / 2, { align: 'center' });
      doc.line(xPos + colWidths.qty, yPosition, xPos + colWidths.qty, yPosition + rowHeight);
      xPos += colWidths.qty;
      
      // UNIT COST column
      doc.text(formatNumberWithCommas(item.unitPrice), xPos + colWidths.unitCost / 2, yPosition + rowHeight / 2, { align: 'center' });
      doc.line(xPos + colWidths.unitCost, yPosition, xPos + colWidths.unitCost, yPosition + rowHeight);
      xPos += colWidths.unitCost;
      
      // TOTAL COST column
      doc.text(formatNumberWithCommas(itemTotal), xPos + colWidths.totalCost / 2, yPosition + rowHeight / 2, { align: 'center' });
      
      yPosition += rowHeight;
      itemNumber++;
    }
    
    // Close table
    doc.setDrawColor(0, 0, 0);
    doc.line(tableStartX, yPosition, tableStartX + tableWidth, yPosition);
    yPosition += 10;
    
    // Extra charges section
    if (quotationData.extras && quotationData.extras.length > 0) {
      checkNewPage(30);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('EXTRA CHARGES:', 15, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      quotationData.extras.forEach((extra) => {
        if (extra.description && extra.amount > 0) {
          checkNewPage(6);
          doc.text(`• ${extra.description}`, 20, yPosition);
          doc.text(`Rs. ${formatNumberWithCommas(extra.amount)}`, pageWidth - 15, yPosition, { align: 'right' });
          yPosition += 6;
        }
      });
      
      yPosition += 5;
    }
    
    // Summary section
    checkNewPage(50);
    
    doc.setLineWidth(1);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 10;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('QUOTATION SUMMARY', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Subtotal
    doc.text('Subtotal (Machine Prices):', 15, yPosition);
    doc.text(`Rs. ${formatNumberWithCommas(quotationData.subtotal)}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;
    
    // VAT
    if (quotationData.vatAmount > 0) {
      doc.text('VAT:', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(quotationData.vatAmount)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Discount
    if (quotationData.discountAmount > 0) {
      doc.text('Discount Amount:', 15, yPosition);
      doc.text(`-Rs. ${formatNumberWithCommas(quotationData.discountAmount)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Extra charges total
    const extrasTotal = quotationData.extras ? quotationData.extras.reduce((sum, extra) => sum + (extra.amount || 0), 0) : 0;
    if (extrasTotal > 0) {
      doc.text('Extra Charges:', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(extrasTotal)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Total
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('TOTAL AMOUNT:', 15, yPosition);
    doc.text(`Rs. ${formatNumberWithCommas(quotationData.finalTotal)}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 12;
    
    // Amount in words
    checkNewPage(10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const amountInWords = numberToWords(Math.floor(quotationData.finalTotal));
    doc.text(`SAY TOTAL: ${amountInWords}`, 15, yPosition);
    yPosition += 15;
    
    // Terms and conditions
    checkNewPage(80);
    
    doc.setFont('helvetica', 'bold');
    doc.text('TERMS & CONDITIONS:', 15, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    
    doc.setFontSize(9);
    doc.text('• Your confirmation required by purchase order. Payment cheque must be ready to collect same day', 15, yPosition);
    yPosition += 4;
    doc.text('  after trial.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• This quotation will only valid for one weeks.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• 50% Advance payment should be placed when placing the order.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• The advance payments that paid to confirm orders are non-refundable under any circumstance.', 15, yPosition);
    yPosition += 4;
    doc.text('  If required any further arrangements, should contact us in advance prior to shipping.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• These prices above are at the present dollar rate, and it will stay the same after you confirmed', 15, yPosition);
    yPosition += 4;
    doc.text('  the order. But by the time when we are delivering the order, if the VAT/dollar increments or', 15, yPosition);
    yPosition += 4;
    doc.text('  additional taxes has imposed, those rates will be added to total cost of this quotation accordingly.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• Delivery time - 45-60 days after confirming the order.', 15, yPosition);
    yPosition += 5;
    
    doc.text('• Please be kind enough to release the bid documents to our representative at the following details.', 15, yPosition);
    yPosition += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT TERMS:', 15, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(' Full payment should be paid on delivery in cash.', 45, yPosition);
    yPosition += 15;
    
    // Bank details
    // checkNewPage(30);
    // doc.setFont('helvetica', 'bold');
    // doc.setFontSize(10);
    // doc.text('BANK DETAILS', 15, yPosition);
    // doc.setFont('helvetica', 'normal');
    // doc.setFontSize(9);
    // yPosition += 6;
    // doc.text('BANK NAME - BOC BANK (KESBEWA BRANCH)', 15, yPosition);
    // yPosition += 5;
    // doc.text('ACCOUNT NAME - P.E. INDUSTRIAL AUTOMATION (PVT). LTD', 15, yPosition);
    // yPosition += 5;
    // doc.text('ACCOUNT NUMBER - 0094292544', 15, yPosition);
    // yPosition += 5;
    // doc.text('BRANCH CODE - 620', 15, yPosition);
    // yPosition += 15;
    
    // Closing
    checkNewPage(25);
    doc.setFontSize(10);
    doc.text('Thank you for your interest in our products. We look forward to serving you.', 15, yPosition);
    yPosition += 10;
    doc.text('Yours Faithfully,', 15, yPosition);
    yPosition += 5;
    doc.text('P.E.INDUSTRIAL AUTOMATION (PVT).LTD', 15, yPosition);
    yPosition += 10;
    doc.text('Approved', 15, yPosition);
    yPosition += 5;
    doc.text('Pradeep Jayawardana', 15, yPosition);
    yPosition += 5;
    doc.text('Director', 15, yPosition);
    
    // Add footer to all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text('Note: Computer Generated Document', 15, pageHeight - 10);
      if (i > 1) {
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    }
    
    // Generate filename
    const filename = `Quotation_${quotationId}_${currentDate.toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
    doc.save(filename);
    
    return {
      success: true,
      filename: filename,
      quotationId: quotationId,
      message: 'Quotation generated successfully'
    };
    
  } catch (error) {
    console.error('Error generating quotation:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate quotation'
    };
  }
};
