import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptId: string;
  salonName: string;
  salonAddress?: string;
  salonPhone?: string;
  barberName: string;
  serviceName: string;
  servicePrice?: number;
  serviceDuration?: number;
  appointmentDate: string;
  appointmentTime: string;
  endTime?: string;
  token: string;
  customerName?: string;
  customerPhone: string;
  status: string;
}

export function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [280, 500],
      margin: 15,
      info: {
        Title: `Booking Receipt - ${data.token}`,
        Author: 'SalonLink',
        Subject: 'Appointment Receipt'
      }
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = 280;
    const centerX = pageWidth / 2;

    function centerText(text: string, y: number, size: number = 10, bold: boolean = false) {
      const width = doc.widthOfString(text);
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica', size).text(text, centerX - width / 2, y);
    }

    function divider(y: number) {
      doc.moveTo(15, y).lineTo(pageWidth - 15, y).strokeColor('#cccccc').stroke();
    }

    let y = 20;

    centerText('SALONLINK', y, 18, true);
    y += 22;
    centerText('Booking Receipt', y, 10, false);
    y += 8;
    doc.fontSize(7).fillColor('#999999');
    centerText(`Receipt #${data.receiptId}`, y, 7);
    y += 12;

    divider(y);
    y += 12;

    doc.fillColor('#333333');

    doc.font('Helvetica-Bold', 9).text('SALON', 15, y);
    y += 11;
    doc.font('Helvetica', 9).text(data.salonName, 15, y);
    y += 10;
    if (data.salonAddress) {
      doc.fontSize(8).fillColor('#666666').text(data.salonAddress, 15, y);
      y += 9;
    }
    if (data.salonPhone) {
      doc.fontSize(8).text(data.salonPhone, 15, y);
      y += 9;
    }
    y += 6;

    divider(y);
    y += 10;

    doc.fillColor('#333333').font('Helvetica-Bold', 9).text('APPOINTMENT DETAILS', 15, y);
    y += 14;

    const labelX = 15;
    const valueX = 95;
    const rowH = 11;

    function row(label: string, value: string) {
      doc.font('Helvetica', 8).fillColor('#999999').text(label, labelX, y);
      doc.font('Helvetica-Bold', 9).fillColor('#333333').text(value, valueX, y);
      y += rowH;
    }

    row('Barber:', data.barberName);
    row('Service:', data.serviceName);

    if (data.serviceDuration) {
      row('Duration:', `${data.serviceDuration} min`);
    }
    if (data.servicePrice) {
      row('Price:', `Rs. ${data.servicePrice.toLocaleString()}`);
    }

    row('Date:', data.appointmentDate);
    const timeStr = data.endTime
      ? `${data.appointmentTime} - ${data.endTime}`
      : data.appointmentTime;
    row('Time:', timeStr);

    y += 4;

    doc.font('Helvetica-Bold', 11).fillColor('#333333');
    const tokenLabel = 'Token:';
    doc.font('Helvetica', 8).fillColor('#999999').text(tokenLabel, labelX, y);
    doc.font('Helvetica-Bold', 14).fillColor('#7c3aed');
    const tokenText = `  ${data.token}`;
    doc.text(tokenText, labelX + doc.widthOfString(tokenLabel) + 2, y - 2);
    y += 22;

    divider(y);
    y += 10;

    centerText('STATUS: CONFIRMED', y, 11, true);
    doc.fillColor('#10b981');
    y += 6;
    centerText('✓', y, 16, true);
    y += 18;

    divider(y);
    y += 10;

    doc.fillColor('#999999').font('Helvetica', 7);
    centerText('Thank you for choosing us!', y, 7);
    y += 9;
    centerText('Please show this receipt at the salon.', y, 7);
    y += 9;
    centerText('Have questions? Contact the salon directly.', y, 7);
    y += 14;

    doc.fontSize(6).fillColor('#bbbbbb');
    centerText(`Generated on ${new Date().toLocaleString('en-IN')}`, y, 6);

    doc.end();
  });
}
