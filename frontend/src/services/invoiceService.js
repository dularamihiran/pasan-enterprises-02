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

export const generateInvoice = async (saleData, orderData) => {
  try {
    // Create new PDF document
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const marginBottom = 30; // Reserve space for footer
    
    let yPosition = 20;
    let currentPage = 1;
    
    // Determine document title based on VAT availability
    const vatAmount = parseFloat(saleData.vatAmount) || 0;
    const hasVatPercentage =
      (parseFloat(saleData.vatPercentage) || 0) > 0 ||
      (saleData.items || []).some((item) => (parseFloat(item.vatPercentage) || 0) > 0);
    const documentTitle = vatAmount > 0 || hasVatPercentage ? 'TAX INVOICE' : 'INVOICE';
    
    // Load logo
    let logoBase64 = null;
    try {
      logoBase64 = await loadImageAsBase64('/images/old_logo1.png');
    } catch (error) {
      console.warn('Could not load logo:', error);
    }

    // Load payment QR code
    let qrBase64 = null;
    try {
      qrBase64 = await loadImageAsBase64('/images/qr.png');
    } catch (error) {
      console.warn('Could not load payment QR code:', error);
    }

    // Function to add header to each page
    const addHeader = () => {
      // Add logo and watermark
      if (logoBase64) {
        // Logo in top left (square, bigger size)
        const logoSize = 40; // Increased from 30x20 to 40x40 (square)
        doc.addImage(logoBase64, 'PNG', 15, 10, logoSize, logoSize);
        
        // Watermark (logo in center, transparent, bigger)
        const watermarkSize = 150; // Increased from 80 to 120
        const watermarkX = (pageWidth - watermarkSize) / 2;
        const watermarkY = (pageHeight - watermarkSize) / 2;
        
        // Save the current graphics state
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.2 }));
        doc.addImage(logoBase64, 'PNG', watermarkX, watermarkY, watermarkSize, watermarkSize);
        doc.restoreGraphicsState();
      }
      
      // Company details (top right)
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PASAN ENTERPRISES (PVT). LTD', pageWidth - 15, 15, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('194/20/12, Thalgahahena Road, Kesbewa,', pageWidth - 15, 22, { align: 'right' });
      doc.text('Piliyandala, Sri Lanka.', pageWidth - 15, 27, { align: 'right' });
      doc.text('+94717694334', pageWidth - 15, 32, { align: 'right' });
      doc.text('+94763995483', pageWidth - 15, 37, { align: 'right' });
    };
    
    // Function to check if we need a new page
    const checkNewPage = (requiredSpace = 15) => {
      if (yPosition + requiredSpace > pageHeight - marginBottom) {
        doc.addPage();
        currentPage++;
        addHeader();
        yPosition = 55; // Reset position after header
        return true;
      }
      return false;
    };
    
    // Add header to first page
    addHeader();
    
    yPosition = 55; // Increased from 50 to 55 to account for bigger logo
    
    // Document title (Invoice or Quotation)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Invoice details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const currentDate = new Date();
    const invoiceDate = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()}`;
    const invoiceTime = currentDate.toLocaleTimeString();
    
    doc.text(`Buyer: ${saleData.customerInfo.name}`, 15, yPosition);
    doc.text(`Invoice Number: ${orderData.orderId}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;
    

    // Add customer VAT number if provided (left side, below Buyer name)
    if (saleData.customerVatNumber && saleData.customerVatNumber.trim()) {
      doc.text(`Customer VAT No: ${saleData.customerVatNumber}`, 15, yPosition);
    }

    // Add Supplier VAT number (right side)
    doc.text('Supplier VAT NO: 179781190-7000', pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;

    // Add phone number
    if (saleData.customerInfo.phone) {
      doc.text(`Phone: ${saleData.customerInfo.phone}`, 15, yPosition);
    }
    yPosition += 6;
    
    
    // Add customer address below buyer name if address exists
    if (saleData.customerInfo.address && saleData.customerInfo.address.trim()) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Address: ${saleData.customerInfo.address}`, 15, yPosition);
      doc.setFontSize(10); // Reset font size
      yPosition += 6;
    }
    
    yPosition += 6;
    
    doc.text(`Date: ${invoiceDate}`, 15, yPosition);
    doc.text(`Time: ${invoiceTime}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 15;
    
    // Function to draw table header
    const drawTableHeader = () => {
      // Warranty column removed - Description column widened to use the freed space.
      // Old layout: [15, 30, 75, 110, 145, 175] // No., Description, Qty, Unit Price, Warranty, Amount
      const colPositions = [15, 30, 120, 150, 175]; // No., Description, Qty, Unit Price, Amount
      
      // Check if we need a new page for header
      checkNewPage(15);
      
      // Draw table header
      doc.setFillColor(240, 240, 240);
      doc.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('No.', colPositions[0], yPosition);
      doc.text('Description', colPositions[1], yPosition);
      doc.text('Qty', colPositions[2], yPosition);
      doc.text('Unit Price', colPositions[3] + 10, yPosition, { align: 'right' });
      // doc.text('Warranty', colPositions[4] + 15, yPosition, { align: 'right' });
      doc.text('Amount', colPositions[4] + 20, yPosition, { align: 'right' });
      
      yPosition += 10;
      return colPositions;
    };
    
    // Draw initial table header
    const colPositions = drawTableHeader();
    
    // Table content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let itemNumber = 1;
    let machinesSubtotalExVat = 0;
    
    // Add cart items with detailed information
    saleData.items.forEach((item, index) => {
      // Check if we need a new page for this item
      checkNewPage(10);
      
      const cartItem = saleData.cart?.find(c => c.machineId === item.machineId) || item;
      const quantity = cartItem.quantity || item.quantity || 0;
      const unitPriceInclVat = cartItem.unitPrice || item.unitPrice || 0;
      const vatPercentage = parseFloat(cartItem.vatPercentage ?? item.vatPercentage) || 0;
      const vatMultiplier = 1 + (vatPercentage / 100);
      const unitPriceExVat = vatMultiplier > 0 ? (unitPriceInclVat / vatMultiplier) : unitPriceInclVat;
      const itemTotal = unitPriceExVat * quantity;
      machinesSubtotalExVat += itemTotal;
      
      // Warranty column removed from the table
      // const warrantyMonths = cartItem.warrantyMonths || item.warrantyMonths || 12;

      doc.text(itemNumber.toString(), colPositions[0], yPosition);

      // Handle long descriptions by wrapping text (limit raised from 20 to 40 chars for the wider column)
      const description = cartItem.name || item.name || 'Item';
      if (description.length > 40) {
        const words = description.split(' ');
        let line1 = '', line2 = '';
        let currentLength = 0;

        for (let word of words) {
          if (currentLength + word.length + 1 <= 40) {
            line1 += (line1 ? ' ' : '') + word;
            currentLength += word.length + 1;
          } else {
            line2 += (line2 ? ' ' : '') + word;
          }
        }
        
        doc.text(line1, colPositions[1], yPosition);
        if (line2) {
          doc.text(line2, colPositions[1], yPosition + 3);
        }
      } else {
        doc.text(description, colPositions[1], yPosition);
      }
      
      doc.text(quantity.toString(), colPositions[2], yPosition);
      doc.text(formatNumberWithCommas(unitPriceExVat), colPositions[3] + 10, yPosition, { align: 'right' });
      // doc.text(warrantyMonths.toString() + 'M', colPositions[4] + 15, yPosition, { align: 'right' });
      doc.text(formatNumberWithCommas(itemTotal), colPositions[4] + 20, yPosition, { align: 'right' });
      
      yPosition += 5;
      
      // Display machine note if it exists
      const machineNote = cartItem.note || item.note || '';
      if (machineNote.trim()) {
        checkNewPage(8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        const noteText = `Note: ${machineNote}`;
        // Wrap note text with proper margins (from Description column to right margin)
        const maxNoteWidth = (pageWidth - 15) - colPositions[1]; // Width from Description column to right edge
        const noteLines = doc.splitTextToSize(noteText, maxNoteWidth);
        noteLines.forEach((line) => {
          doc.text(line, colPositions[1], yPosition);
          yPosition += 4;
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }
      
      yPosition += 3;
      itemNumber++;
    });
    
    // Add separator line for machines section
    if (saleData.items.length > 0) {
      checkNewPage(10);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 5;
      
      // Machines subtotal
      doc.setFont('helvetica', 'bold');
      doc.text('MACHINES SUBTOTAL:', colPositions[2], yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(machinesSubtotalExVat)}`, colPositions[4] + 20, yPosition, { align: 'right' });
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
    }
    
    // Add extras if any
    if (saleData.extras && saleData.extras.length > 0) {
      checkNewPage(15);
      
      // Extra charges header
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRA CHARGES:', 15, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      
      saleData.extras.forEach((extra) => {
        if (extra.description && extra.amount > 0) {
          checkNewPage(8);
          
          doc.text(itemNumber.toString(), colPositions[0], yPosition);
          
          // Handle long extra descriptions (limit raised from 25 to 40 chars for the wider column)
          const description = extra.description;
          if (description.length > 40) {
            const words = description.split(' ');
            let line1 = '', line2 = '';
            let currentLength = 0;

            for (let word of words) {
              if (currentLength + word.length + 1 <= 40) {
                line1 += (line1 ? ' ' : '') + word;
                currentLength += word.length + 1;
              } else {
                line2 += (line2 ? ' ' : '') + word;
              }
            }
            
            doc.text(line1, colPositions[1], yPosition);
            if (line2) {
              doc.text(line2, colPositions[1], yPosition + 3);
            }
          } else {
            doc.text(description, colPositions[1], yPosition);
          }
          
          doc.text('1', colPositions[2], yPosition);
          doc.text(formatNumberWithCommas(extra.amount), colPositions[3] + 10, yPosition, { align: 'right' });
          // doc.text('-', colPositions[4] + 15, yPosition, { align: 'right' }); // Warranty column (removed)
          doc.text(formatNumberWithCommas(extra.amount), colPositions[4] + 20, yPosition, { align: 'right' });
          
          yPosition += 8;
          itemNumber++;
        }
      });
      
      // Extra charges subtotal
      checkNewPage(10);
      doc.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 5;
      
      const extrasTotal = saleData.extras.reduce((sum, extra) => sum + (extra.amount || 0), 0);
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRA CHARGES SUBTOTAL:', colPositions[2], yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(extrasTotal)}`, colPositions[4] + 20, yPosition, { align: 'right' });
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
    }
    
    // Calculate final totals
    const subtotal = saleData.subtotal || machinesSubtotalExVat;
    const discountAmount = saleData.discountAmount || 0;
    const finalTotal = saleData.finalTotal || (subtotal + vatAmount - discountAmount);
    
    // SUMMARY SECTION
    checkNewPage(40); // Reserve space for summary section
    
    // Draw thick separator line for summary
    doc.setLineWidth(1);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 10;
    
    // Summary header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ORDER SUMMARY', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    
    // Summary content
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    // Subtotal
    doc.text('Subtotal (Machine Prices):', 15, yPosition);
    doc.text(`Rs. ${formatNumberWithCommas(subtotal)}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 6;
    
    // VAT details (if applicable)
    if (vatAmount > 0) {
      doc.text('VAT (Per-Item Calculation):', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(vatAmount)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Discount (if applicable)
    if (discountAmount > 0) {
      doc.text('Discount Amount:', 15, yPosition);
      doc.text(`-Rs. ${formatNumberWithCommas(discountAmount)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Extra charges (if applicable)
    const extrasTotal = saleData.extras ? saleData.extras.reduce((sum, extra) => sum + (extra.amount || 0), 0) : 0;
    if (extrasTotal > 0) {
      doc.text('Extra Charges:', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(extrasTotal)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
    }
    
    // Draw line above total
    doc.setLineWidth(0.5);
    doc.line(15, yPosition, pageWidth - 15, yPosition);
    yPosition += 8;
    
    // Total amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('FINAL TOTAL:', 15, yPosition);
    doc.text(`Rs. ${formatNumberWithCommas(finalTotal)}`, pageWidth - 15, yPosition, { align: 'right' });
    yPosition += 10;
    
    // Payment details (if partial payment)
    if (saleData.paymentType === 'partial' || (saleData.paidAmount && saleData.paidAmount < finalTotal)) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      checkNewPage(15);
      
      // Paid amount
      doc.text('Paid Amount:', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(saleData.paidAmount || 0)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 6;
      
      // Remaining amount
      doc.setFont('helvetica', 'bold');
      doc.text('Remaining Amount:', 15, yPosition);
      doc.text(`Rs. ${formatNumberWithCommas(saleData.remainingAmount || 0)}`, pageWidth - 15, yPosition, { align: 'right' });
      yPosition += 10;
    }
    
    yPosition += 5;
    
    // Amount in words
    checkNewPage(10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const amountInWords = numberToWords(Math.floor(finalTotal));
    doc.text(`SAY TOTAL: ${amountInWords}`, 15, yPosition);
    yPosition += 6;

    // Payment method details
    const normalizedPaymentMethod = (saleData.paymentMethod || '').toString().trim().toLowerCase();
    let paymentMethodLabel = 'Cash';
    if (normalizedPaymentMethod === 'bank transfer' || normalizedPaymentMethod === 'bank_transfer' || normalizedPaymentMethod === 'transfer') {
      paymentMethodLabel = 'Bank Transfer';
    } else if (normalizedPaymentMethod === 'cheque' || normalizedPaymentMethod === 'check') {
      paymentMethodLabel = 'Cheque';
    } else if (normalizedPaymentMethod === 'cash') {
      paymentMethodLabel = 'Cash';
    }

    checkNewPage(10);
    doc.text(`Payment Method: ${paymentMethodLabel}`, 15, yPosition);
    yPosition += 6;

    if (paymentMethodLabel === 'Cheque') {
      const chequeNumber = (saleData.chequeNumber || saleData.checkNumber || '').toString().trim();
      if (chequeNumber) {
        doc.text(`Cheque Number: ${chequeNumber}`, 15, yPosition);
        yPosition += 6;
      }
    }

    yPosition += 9;
    
    // Check for new page before terms and conditions
    checkNewPage(60);
    
    // Payment terms
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT TERMS:', 15, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;
    doc.text('100% by cash on delivery or by a cheque draw to the account name of', 15, yPosition);
    yPosition += 5;
    doc.text('"PASAN ENTERPRISES (PVT).LTD"', 15, yPosition);
    yPosition += 10;
    
    // Warranty period section disabled - warranty periods are no longer printed on the invoice.
    // Kept commented out in case it needs to be re-enabled.
    // // Warranty information (variable per item)
    // doc.setFont('helvetica', 'bold');
    // doc.text('WARRANTY:', 15, yPosition);
    // doc.setFont('helvetica', 'normal');
    // yPosition += 6;
    //
    // // Check if all items have the same warranty
    // const warranties = saleData.items.map(item => {
    //   const cartItem = saleData.cart?.find(c => c.machineId === item.machineId) || item;
    //   return cartItem.warrantyMonths || item.warrantyMonths || 12;
    // });
    //
    // const uniqueWarranties = [...new Set(warranties)];
    //
    // if (uniqueWarranties.length === 1) {
    //   doc.text(`${uniqueWarranties[0]} MONTHS FROM INVOICE DATE`, 15, yPosition);
    // } else {
    //   doc.text('VARIABLE WARRANTY PERIODS AS SPECIFIED PER ITEM:', 15, yPosition);
    //   yPosition += 5;
    //   saleData.items.forEach((item, index) => {
    //     const cartItem = saleData.cart?.find(c => c.machineId === item.machineId) || item;
    //     const warranty = cartItem.warrantyMonths || item.warrantyMonths || 12;
    //     const itemName = (cartItem.name || item.name || 'Item').substring(0, 30);
    //     doc.text(`• ${itemName}: ${warranty} months`, 20, yPosition);
    //     yPosition += 4;
    //   });
    // }
    // yPosition += 8;

    // Terms & conditions heading (replaces the old WARRANTY heading)
    doc.setFont('helvetica', 'bold');
    doc.text('TERMS & CONDITIONS:', 15, yPosition);
    doc.setFont('helvetica', 'normal');
    yPosition += 6;

    // Additional terms
    const termsBullets = [
      'THE WARRANTY DOES NOT COVER RUNNING REPAIRS, WEAR AND TEAR OF ANY PARTS, OR DAMAGE CAUSED BY HIGH-CURRENT ELECTRIC BURNS.',
      'A ONE-TIME FULL COMPREHENSIVE TRAINING WILL BE GIVEN FREE OF CHARGE.'
    ];
    termsBullets.forEach((bullet) => {
      const bulletLines = doc.splitTextToSize(bullet, pageWidth - 35);
      checkNewPage(bulletLines.length * 5);
      doc.text('•', 15, yPosition);
      bulletLines.forEach((line) => {
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
    });
    yPosition += 5;

    // Payment info box with QR code
    const boxX = 15;
    const boxWidth = 125;
    const boxHeight = 42;
    const qrSize = 34;
    checkNewPage(boxHeight + 5);
    const boxTop = yPosition;
    doc.setLineWidth(0.4);
    doc.rect(boxX, boxTop, boxWidth, boxHeight);

    let infoY = boxTop + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Payment Info:', boxX + 5, infoY);
    doc.setLineWidth(0.3);
    doc.line(boxX + 5, infoY + 1, boxX + 5 + doc.getTextWidth('Payment Info:'), infoY + 1);
    infoY += 8;

    doc.setFontSize(10);
    const paymentInfo = [
      ['BANK NAME - ', 'BOC BANK (KESBEWA BRANCH)'],
      ['ACCOUNT NAME - ', 'PASAN ENTERPRISES'],
      ['ACCOUNT NUMBER - ', '0086689388'],
      ['BRANCH CODE - ', '620']
    ];
    paymentInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, boxX + 5, infoY);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont('helvetica', 'bold');
      doc.text(value, boxX + 5 + labelWidth, infoY);
      infoY += 6;
    });

    if (qrBase64) {
      doc.addImage(qrBase64, 'PNG', boxX + boxWidth - qrSize - 4, boxTop + (boxHeight - qrSize) / 2, qrSize, qrSize);
    }

    doc.setFont('helvetica', 'normal');
    doc.setLineWidth(0.2);
    yPosition = boxTop + boxHeight + 12;

    // Thank you and signature
    checkNewPage(25);
    doc.text('Thank You.', 15, yPosition);
    yPosition += 5;
    doc.text('Yours Faithfully,', 15, yPosition);
    yPosition += 5;
    doc.text('PASAN ENTERPRISES (PVT).LTD', 15, yPosition);
    yPosition += 10;
    doc.text('Approved', 15, yPosition);
    yPosition += 5;
    doc.text('Pradeep Jayawardana', 15, yPosition);
    yPosition += 5;
    doc.text('Director', 15, yPosition);
    yPosition += 10;

    // Delivery confirmation and signatures
    checkNewPage(30);
    const signatureLineWidth = 40;
    const sellerSigX = pageWidth - 15 - signatureLineWidth;
    const customerSigX = sellerSigX - 8 - signatureLineWidth;
    const signatureLineY = yPosition + 15; // Leave space above the lines for signing

    doc.setLineDashPattern([0.5, 0.7], 0);
    doc.line(customerSigX, signatureLineY, customerSigX + signatureLineWidth, signatureLineY);
    doc.line(sellerSigX, signatureLineY, sellerSigX + signatureLineWidth, signatureLineY);
    doc.setLineDashPattern([], 0);

    const signatureLabelY = signatureLineY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text("Customer's Signature", customerSigX + signatureLineWidth / 2, signatureLabelY, { align: 'center' });
    doc.text("Seller's Signature", sellerSigX + signatureLineWidth / 2, signatureLabelY, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    const confirmationLines = doc.splitTextToSize('WE CONFIRM THAT THE MACHINES WERE RECEIVED WITHOUT ANY DEFECTS.', customerSigX - 25);
    doc.text('•', 15, signatureLabelY);
    confirmationLines.forEach((line, index) => {
      doc.text(line, 20, signatureLabelY + index * 4);
    });

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
    const documentType = 'Invoice';
    const filename = `${documentType}_${orderData.orderId}_${currentDate.toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
    doc.save(filename);
    
    return {
      success: true,
      filename: filename,
      message: `${documentType} generated successfully`
    };
    
  } catch (error) {
    console.error('Error generating invoice:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate invoice'
    };
  }
};

// Backward-compatible wrapper; quotation PDFs are handled in quotationService
export const generateQuotation = async (saleData, orderData) => {
  return await generateInvoice(saleData, orderData);
};