import { Filesystem, Directory } from '@capacitor/filesystem';
import { Toast } from '@capacitor/toast';
import { Share } from '@capacitor/share';

export class PDFDownloader {
  static async downloadPDF(pdfBlob: Blob, filename: string): Promise<void> {
    try {
      // Check if Capacitor APIs are actually available (not just the global)
      const isMobileApp = typeof (window as any).Capacitor !== 'undefined' && 
                         (window as any).Capacitor.isNativePlatform?.();

      if (isMobileApp) {
        // Mobile app: Save to filesystem and share
        await this.mobileDownload(pdfBlob, filename);
      } else {
        // Browser: Use traditional download
        this.browserDownload(pdfBlob, filename);
      }
    } catch (error) {
      console.error('PDF download failed:', error);
      // Fallback to browser download on any error
      this.browserDownload(pdfBlob, filename);
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
      await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true
      });

      // Try to share the file (optional - won't fail the whole process)
      try {
        await Share.share({
          title: 'Money Tracker Pro Statement',
          text: 'Please find attached your statement PDF',
          url: base64Data,
          dialogTitle: 'Share PDF'
        });
      } catch (shareError) {
        console.log('Share failed, but file was saved:', shareError);
      }

      // Show success toast
      await Toast.show({
        text: `PDF saved to downloads: ${filename}`,
        duration: 'long'
      });

    } catch (error) {
      console.error('Mobile download failed:', error);
      throw error; // Let the parent catch handle the fallback
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
