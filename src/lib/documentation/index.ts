import { Packer } from 'docx';
import { saveAs } from 'file-saver';
import { generatePlatformDocumentation } from './platformDocumentation';
import { generateTechnicalDocumentation } from './technicalDocumentation';

export const downloadPlatformDocumentation = async (): Promise<void> => {
  const doc = generatePlatformDocumentation();
  const blob = await Packer.toBlob(doc);
  const filename = `InnoTrue_Hub_Platform_Documentation_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
};

export const downloadTechnicalDocumentation = async (): Promise<void> => {
  const doc = generateTechnicalDocumentation();
  const blob = await Packer.toBlob(doc);
  const filename = `InnoTrue_Hub_Technical_Documentation_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, filename);
};
