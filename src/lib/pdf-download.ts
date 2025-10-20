import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Share } from '@capacitor/share';

export class PDFDownloader {
  static async downloadPDF(pdfBlob: Blob, filename: string): Promise<void> {
    try {
      // Check if we're running in a mobile app
      const isMobileApp = window.navigator.userAgent.includes('Capacitor') || 
                         (window as any).Capacitor !== undefined;

      if (isMobileApp) {
        // Mobile app: Save to filesystem and share
        await this.mobileDownload(pdfBlob, filename);
      } else {
        // Browser: Use traditional download
        this.browserDownload(pdfBlob, filename);
      }
    } catch (error) {
      console.error('PDF download failed:', error);
      throw error;
    }
  }

  private static browserDownload(pdfBlob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private static async mobileDownload(pdfBlob: Blob, filename: string): Promise<void> {
    try {
      // Convert Blob to base64
      const base64Data = await this.blobToBase64(pdfBlob);
      
      // Save to downloads directory
      const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true
      });

      // Show success toast
      await Toast.show({
        text: `PDF saved: ${filename}`,
        duration: 'short'
      });

      // Share the file  
      await Share.share({
        title: 'Money Tracker Pro Statement',
        text: 'Please find attached your statement PDF',
        files: [base64Data] as any
      });

    } catch (error) {
      console.error('Mobile download failed:', error);
      
      // Fallback: Try browser download method
      this.browserDownload(pdfBlob, filename);
      
      // Show error toast
      await Toast.show({
        text: 'Download failed, trying browser method',
        duration: 'short'
      });
    }
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
