<script lang="ts">
	import PDFMerger from 'pdf-merger-js/browser'
	import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
	import 'pdfjs-dist/build/pdf.worker.mjs';	
	import { PDFDocument } from 'pdf-lib';
	import { uploadedFiles, type PDFFile, type PDFDocumentType } from '$lib/stores/uploadedFiles'
	import Pdf from '$lib/components/Pdf.svelte'
	import {flip} from 'svelte/animate';
	import { Toaster, toast } from 'svelte-sonner'

	let fileInput: HTMLInputElement
	let addFileInput: HTMLInputElement

	const hInputFile = async (event: Event ) => {
		if(!fileInput.files || fileInput?.files.length == 0) return
		const files = fileInput.files
		return showPdfFile(files)
	}

	const hAddInputFile = async (event: Event ) => {
		uploading = true
		if(!addFileInput.files || addFileInput?.files.length == 0) uploading = false
		else {
			const files = addFileInput.files
			await showPdfFile(files)
			uploading = false
		}
	}

	let uploading = false
	const hDropFile = async (event: DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		uploading = true
		const files: File[] = []

		 if (event.dataTransfer?.items) {
			// Use DataTransferItemList interface to access the file(s)
			[...event.dataTransfer.items].forEach((item, i) => {
			// If dropped items aren't files, reject them
			// console.log('file from dataTransfer.items');
				if (item.kind === "file") {
					const file = item.getAsFile();
					if(file) files.push(file);
				}
			});
		} else if(!event.dataTransfer?.items && event.dataTransfer?.files) {
			// Use DataTransfer interface to access the file(s)
			// console.log('file from dataTransfer.file');
			[...event.dataTransfer.files].forEach((file, i) => {
				files.push(file);
			});
		} else {
			console.warn('cannot retrieve items/files from drop')
		}
		if(files.length > 0) {
			await showPdfFile(files)
		}
		uploading = false
	}

	const showPdfFile = async (files: FileList | File[]) => {
		const newUploadedFiles = await Promise.all(
			Array.from(files).map(async(file) => {
				const pdfData = URL.createObjectURL(file);
				const pdfDoc = await pdfjsLib.getDocument(pdfData).promise;
				const numPages = pdfDoc.numPages;
				const preview = await loadFirstPage(pdfDoc)
				return { 
					document: pdfDoc as unknown as PDFDocumentType,
					name: file.name,
					url: pdfData,
					numPages: numPages,
					preview: preview 
					} as PDFFile;
			})
		)
		uploadedFiles.update(uploaded => {
			uploaded.push(...newUploadedFiles)
			return uploaded
		})
	}

	const loadFirstPage = async (pdfDoc: pdfjsLib.PDFDocumentProxy) => {
		const page = await pdfDoc.getPage(1)

		const viewport = page.getViewport({ scale: 1 });
		if(!document) return 
		const canvas = document.createElement('canvas');
		const context = canvas.getContext('2d');
		canvas.height = viewport.height;
		canvas.width = viewport.width;

		await page.render({ canvasContext: context as CanvasRenderingContext2D, viewport }).promise
		const imgUrl = canvas.toDataURL()
		return imgUrl
	}

	let processing = false
	const beginMergePdf = async () => {
		try {
			processing = true
			if(!uploadedFiles) return
			const pdfMerger = new PDFMerger()
			let fileName = ''
			for(const file of $uploadedFiles) {
				if(fileName === '') { fileName = defineFIleName(file.name) }
				if(file.selectedPage) { await pdfMerger.add(file.url, file.selectedPage) }
				else { await pdfMerger.add(file.url) }
			}

			// await pdfMerger.setMetadata({
			// 	producer: "pdf-merger-js based script",
			// 	author: "Fanboykun",
			// 	creator: "Fanboykun",
			// 	title: "merging pdf"
			// });

			// Save the merged PDF as a Blob
			const mergedPdfBlob = await pdfMerger.saveAsBlob();

			// Compress the merged PDF
			// const compressedPdfBlob = await compressPdfBlob(mergedPdfBlob);

			//Create a download link for the compressed PDF
			const mergedUrl = URL.createObjectURL(mergedPdfBlob);
			// const mergedUrl = URL.createObjectURL(compressedPdfBlob);

			const a = document.createElement('a')
			a.download = fileName
			a.href = mergedUrl
			a.click()
			URL.revokeObjectURL(mergedUrl)
			processing = false
			return window.location.reload()
		} catch(err) {
			processing = false
			alert('error when merging file')
		}
	}

	function defineFIleName(filename: string): string {
		const now = new Date()
		// const timestamp = `${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`
		const timestamp = now.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: '2-digit' })
		const lastIndex = filename.lastIndexOf('.pdf');
		
		// Check if '.pdf' exists in the string
		if (lastIndex === -1) {
			return filename; // No '.pdf' found, return the original string
		}

		// Return the string sliced up to the last occurrence of '.pdf'
		return `${filename.slice(0, lastIndex)}-merged-${timestamp}.pdf`;
	}

	const compressPdfBlob = async (blob: Blob): Promise<Blob> => {
		// Load the Blob into pdf-lib
		const pdfDoc = await PDFDocument.load(await blob.arrayBuffer());

		// Perform any additional optimizations here (e.g., remove unused objects, reduce image quality, etc.)

		// Save the compressed PDF
		const compressedPdfBytes = await pdfDoc.save({
			useObjectStreams: false, // This can reduce the file size
		});

		// Convert the compressed PDF back to a Blob
		return new Blob([compressedPdfBytes], { type: 'application/pdf' });
	}

	function cutText(text:string) {
		if(text.length > 50) {
			return text.slice(0, 50) + '..'
		}
		return text
	}

	function validatePageInput( event: Event & { currentTarget: HTMLInputElement }, file: PDFFile ) {
		const page = event.currentTarget.value.trim();
		let finalValue: string | number | undefined;

		// Check for a single page number
		if (!isNaN(Number(page))) {
			finalValue = Number(page);
		}
		// Check for comma-separated page numbers
		else if (page.includes(',')) {
			const numberedPages = page
			.split(',')
			.map(p => p.trim()) // Remove any spaces
			.filter(p => !isNaN(Number(p))) // Keep valid numbers only
			.map(Number); // Convert to numbers

			// Assign if there are valid pages
			if (numberedPages.length > 0) {
			finalValue = numberedPages.join(',');
			}
		}
		// Check for page ranges (e.g., "2-5")
		else if (page.includes('-')) {
			const rangePattern = /^\d+-\d+$/;

			// Ensure it matches the pattern like "2-5"
			if (rangePattern.test(page)) {
			const [first, second] = page.split('-').map(Number);

			// Ensure the first page is less than or equal to the second page
			if (first <= second) {
				finalValue = `${first}-${second}`;
			}
			}
		}
		// If finalValue is still undefined, it means the input is invalid
		file.selectedPage = finalValue;
	}

	/** drag and drop (reordering file position)*/
	let draggedIndex: number | null = null;

	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		event.dataTransfer?.setData('text/plain', `${index}`);
	}

	function handleDrop(event: DragEvent, index: number) {
		event.preventDefault();
		moveItem(index)
	}

	function handleTouchMove(event: TouchEvent) {
		event.preventDefault();
		const touch = event.touches[0];
		const element = document.elementFromPoint(touch.clientX, touch.clientY);
		if (element) {
			const dropTarget = element.closest('.pdf-file');
			const index = dropTarget?.getAttribute('data-index')
			if (dropTarget && index) {
				const targetIndex = parseInt(index, 10);
				if (draggedIndex !== null && targetIndex !== draggedIndex) {
					moveItem(targetIndex);
				}
			}
    	}
  	}

	function moveItem(index: number) {
		uploadedFiles.update((files) => {
			if (draggedIndex !== null) {
				const draggedItem = files[draggedIndex];
				files.splice(draggedIndex, 1); // Remove the dragged item
				files.splice(index, 0, draggedItem); // Insert it at the new position
				draggedIndex = null;
			}
			return files;
		});
  	}

	$: {
		if(uploading == true || processing == true) {
			let msg = uploading == true ? 'Uploading' : ''
			msg = processing == true ? 'Processing' : msg
			toast.info(msg)
		}
	}

</script>
<Toaster closeButton position="top-center" duration={1500} />
<div class="min-w-screen min-h-screen bg-gray-100 flex justify-center">
	<div class="flex flex-col w-full p-2 items-center justify-center bg-white shadow-lg">
		{#if $uploadedFiles.length === 0}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="flex" id="input_wrapper" >
			<div on:drop={hDropFile} on:dragover={(e) => { e.preventDefault(); e.stopPropagation() }} class="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
				<div class="text-center">
				<svg class="mx-auto h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd" />
				</svg>
				<div class="mt-4 flex text-sm leading-6 text-gray-600">
					<label for="files" class="relative cursor-pointer rounded-md bg-white font-semibold text-indigo-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
					<span>Upload a file</span>
					<input 
						bind:this={fileInput}
						on:change={hInputFile}
						type="file" 
						name="files" 
						id="files"
						accept=".pdf"
						required
						multiple
						disabled={uploading}
						class="sr-only"
					>
					</label>
					<p class="pl-1">or drag and drop</p>
				</div>
				<p class="text-xs leading-5 text-gray-600">PDF up to 10MB</p>
				</div>
			</div>
		</div>
		{/if}

		{#if $uploadedFiles.length > 0}
		<div id="file_list" class="h-full mt-4 max-w-xs sm:max-w-max sm:px-8 px-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 w-full gap-4 place-content-center place-items-center">
			{#each $uploadedFiles as file, index (file.name)}
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div 
					draggable={true}
					data-index={index}
					on:dragstart={(event) => handleDragStart(event, index)}
					on:dragover={(event) => event.preventDefault() }
					on:drop={(event) => handleDrop(event, index)}
					on:dragend={() => draggedIndex = null}
					on:touchstart={() => draggedIndex = index }
					on:touchmove={handleTouchMove}
					on:touchend={() => draggedIndex = null}
					animate:flip={ { duration: 100 } }
					class:dragging={draggedIndex === index}
					class="pdf-file cursor-grab w-full h-full flex flex-col items-center justify-between border-2 p-4 gap-y-1 rounded-lg max-w-sm">
					<img src={file.preview} class=" bg-cover max-h-[150px]" alt="document preview">
					<Pdf />
					<label for="selectedPage" class="block text-sm font-medium leading-6 text-gray-900">{cutText(file.name)}</label>
					<p class="text-xs text-gray-500">{file.numPages} page(s)</p>
					<div class="mt-2 flex gap-2 w-full">
						<div class="flex w-full rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600 sm:max-w-sm">
						<input type="text" on:keyup={(event) => validatePageInput(event, file)} min="1" name="selectedPage" id="selectedPage" placeholder="Enter pages (e.g., 1,2,3 or 4-6)" class="block flex-1 w-full border-0 bg-transparent py-1.5 pl-1 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6">
						</div>
					</div>
				</div>
			{/each}
			<div class="w-full min-h-40 h-full flex items-center justify-center border-2 p-4 gap-y-1 rounded-lg max-w-sm">
				<button type="button" disabled={uploading} on:click={() => { addFileInput.click() }} class="w-full h-full border border-dashed flex justify-center items-center">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-12 text-gray-500">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
					</svg>					  
				</button>
				<input 
						bind:this={addFileInput}
						on:change={hAddInputFile}
						type="file" 
						name="addFiles" 
						id="addFiles"
						accept=".pdf"
						required
						multiple
						disabled={uploading}
						class="sr-only"
					>
			</div>
		</div>
		<div class="mt-2 w-full flex items-center justify-center">
			<button on:click={beginMergePdf} disabled={processing} class="w-fit flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 rounded-xl shadow-md font-semibold text-md text-gray-200 hover:text-white hover:shadow-lg hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50" type="button">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
				<span>Process</span>
			</button>
		</div>
		{/if}
	</div>

</div>

<style>
	.dragging {
		@apply opacity-40 shadow-2xl
	}
</style>
