import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Mock data
const mockUsers = [
  {
    userId: 'user1',
    email: 'user1@example.com',
    displayName: 'User One',
    role: 'admin'
  }
];

const mockCustomers = [
  {
    phone: '+1234567890',
    name: 'John Doe',
    tags: ['vip', 'frequent'],
    notes: 'Prefers morning appointments',
    lastInteraction: '2024-01-15T10:00:00Z'
  },
  {
    phone: '+0987654321',
    name: 'Jane Smith',
    tags: ['new'],
    notes: 'Interested in premium services',
    lastInteraction: '2024-01-14T15:30:00Z'
  }
];

const mockBookings = [
  {
    bookingId: 'b1',
    customerPhone: '+1234567890',
    serviceType: 'Consultation',
    appointmentTime: '2024-01-20T09:00:00Z',
    status: 'confirmed',
    reminderSent: true,
    createdAt: '2024-01-10T08:00:00Z'
  },
  {
    bookingId: 'b2',
    customerPhone: '+1234567890',
    serviceType: 'Follow-up',
    appointmentTime: '2024-01-25T14:00:00Z',
    status: 'pending',
    reminderSent: false,
    createdAt: '2024-01-15T12:00:00Z'
  }
];

const mockAutomations = [
  {
    ruleId: 'r1',
    trigger: 'New message',
    action: 'Send welcome',
    isActive: true
  },
  {
    ruleId: 'r2',
    trigger: 'Appointment reminder',
    action: 'Send SMS',
    isActive: true
  }
];

const mockLogs = [
  {
    sender: '+1234567890',
    incomingText: 'Hello',
    replyText: 'Hi there!',
    type: 'text',
    timestamp: '2024-01-15T10:00:00Z'
  },
  {
    sender: '+1234567890',
    incomingText: 'Book appointment',
    replyText: 'Sure, when would you like?',
    type: 'text',
    timestamp: '2024-01-15T10:05:00Z'
  }
];

// Function to create Excel file
function createExcel(data, filename) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, sheetData] of Object.entries(data)) {
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, filename);
}

// Main export function
function exportData() {
  const baseDir = 'C:\\Users\\HP\\Desktop\\whatsapp agent';
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  for (const customer of mockCustomers) {
    const customerDir = path.join(baseDir, `${customer.name} ${customer.phone}`);
    if (!fs.existsSync(customerDir)) {
      fs.mkdirSync(customerDir, { recursive: true });
    }

    // Filter data for this customer
    const customerBookings = mockBookings.filter(b => b.customerPhone === customer.phone);
    const customerLogs = mockLogs.filter(l => l.sender === customer.phone);

    const excelData = {
      'Customer Info': [customer],
      'Bookings': customerBookings,
      'Automations': mockAutomations, // Assuming automations are user-wide
      'Logs': customerLogs
    };

    const filename = path.join(customerDir, 'data.xlsx');
    createExcel(excelData, filename);
    console.log(`Created ${filename}`);
  }
}

exportData();