import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import 'pdfjs-dist/build/pdf.worker.mjs';	

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