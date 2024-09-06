import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import 'pdfjs-dist/legacy/build/pdf.worker.entry';
import { writable, type Writable } from 'svelte/store';

export type PDFDocumentType = Awaited<ReturnType<typeof pdfjsLib.getDocument>>['promise']

export type PDFFile = {
    name: string;
    url: string;
    numPages: number;
    document?: Exclude<PDFDocumentType, undefined>;
    selectedPage?: string
    preview?: string
}

export const uploadedFiles: Writable<PDFFile[]> = writable([])