const template = document.createElement('template');
template.innerHTML = `
<style>
#scanner {
	display: block;
	position: relative;
	box-sizing: border-box;
	min-width: 5.14em;
	height: auto;
	margin: 0;
	background: gray;
	text-align: center;
}

video {
	width: 100%;
	height: auto;
}

#info {
	position: absolute;
	font: monospace;
	top: 10px;
	left: 10px;
	width: calc(100% - 20px);
	height: calc(100% - 20px);
	background: rgba(255,255,255,0.7);
	color: black;
	opacity: 0;
	transition: opacity 0.5s;
	text-align: left;
}

table {
	margin: 10px;
}

#info.show {
	opacity: 1;
}
</style>

<div id="scanner">
<video id="camera" muted autoplay="autoplay" playsinline="playsinline"></video>
<div id="info"></div>
</div>
`;

const base64ToBytes = (base64) => {
	const binString = atob(base64);
	return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

const addressTypeName = (value) => {
	switch (value) {
		case '0': return 'Public';
		case '1': return 'Random';
	}
}

const BROADCAST_AUDIO_URI_SCHEME = 'BLUETOOTH:';

const parseBroadcastURI = (str) => {
	// This function is a PoC, parsing an incomplete list of the possible fields
	// listed in the Broadcast Audio URI spec:
	// https://www.bluetooth.com/specifications/specs/broadcast-audio-uri-2/

	// Check that the string starts with "BLUETOOTH:"
	if (!str.startsWith(BROADCAST_AUDIO_URI_SCHEME)) {
		return [];
	}

	const result = [];

	// split sections (;)
	const sections = str.substring(BROADCAST_AUDIO_URI_SCHEME.length).split(';');

	sections.forEach(section => {
		const [key, value] = section.split(':');

		switch (key) {
			case 'AT': // Address type
			result.push({
				type: key,
				name: 'Address type',
				value: addressTypeName(value)
			});
			break;
			case 'BC': // Broadcast code
			case 'BN': // Broadcast name
			result.push({
				type: key,
				name: key == 'BC' ? 'Broadcast Code' : 'Broadcast Name',
				value: new TextDecoder().decode(base64ToBytes(value))
			});
			break;
			case 'AD':
			result.push({
				type: key,
				name: 'Address',
				value: value.match(/.{1,2}/g).join(':')
			});
			break;
			case 'UUID':
			result.push({
				type: key,
				name: 'UUID',
				value: `0x${value}`
			});
			break;
			case 'BI': // Broadcast ID
			result.push({
				type: key,
				name: 'Broadcast ID',
				value: `0x${value.padStart(6,0)}`
			});
			break;
			case 'PI': // PA interval
			result.push({
				type: key,
				name: 'PA interval',
				value: `0x${value.padStart(4,0)}`
			});
			break;
			case 'AS': // Advertising SID
			case 'NS': // Number of subgroups
			result.push({
				type: key,
				name: key == 'AS' ? 'Advertising SID' : 'No. of subgroups',
				value: `0x${value.padStart(2,0)}`
			});
			break;
		}
	});

	return result;
}

export class BauScanner extends HTMLElement {
	#videoStream
	#decoderActive
	#camera
	#barcodeDetector
	#lastCode
	#info

	constructor() {
		super();

		const shadowRoot = this.attachShadow({mode: 'open'});
		shadowRoot.appendChild(template.content.cloneNode(true));

		this.startCamera = this.startCamera.bind(this);
		this.stopCamera = this.stopCamera.bind(this);
		this.decodeQr = this.decodeQr.bind(this);

		this.#lastCode = "";
	}

	connectedCallback() {
		this.#camera = this.shadowRoot?.querySelector('#camera');
		this.#info = this.shadowRoot?.querySelector('#info');

		this.#barcodeDetector = new window.BarcodeDetector();
	}

	async startCamera() {
		const constraints = {video: true, audio: false};
		let stream = await navigator.mediaDevices.getUserMedia(constraints);

		const devices = await navigator.mediaDevices.enumerateDevices();

		const videoDevices = devices.filter(d => d.kind == 'videoinput');

		// Try to find the back camera if using a phone
		const backDevice = videoDevices.find(d => d.label.toLowerCase().includes('back'));

		if (backDevice) {
			constraints.video = {deviceId: backDevice.deviceId};
		}

		stream = await navigator.mediaDevices.getUserMedia(constraints);
		this.#videoStream = stream;

		this.#camera.srcObject = stream;

		this.#decoderActive = true;

		setTimeout(this.decodeQr, 500);
	}

	stopCamera (){
		this.#decoderActive = false;

		try {
			if (this.#videoStream){
				this.#videoStream.getTracks().forEach(t => t.stop());
			}
		} catch (e){
			alert(e.message);
		}
	}

	async decodeQr(){
		const barcodes = await this.#barcodeDetector.detect(this.#camera);

		if (barcodes?.length) {
			for (const barcode of barcodes) {
				const decoded = parseBroadcastURI(barcode.rawValue);

				if (decoded?.length) {
					// Avoid repainting if the data is already shown
					if (this.#lastCode == barcode.rawValue) {
						break;
					}

					this.#lastCode = barcode.rawValue;

					this.showBroadcastInfo(decoded);
					break; // Only use the first code found
				}
			}
		} else {
			this.#lastCode = "";
			this.hideInfo();
		}

		if (this.#decoderActive) {
			// Try again in 100ms
			setTimeout(this.decodeQr, 100);
		}
	}

	showBroadcastInfo(data) {
		const dataStrs = data.map(i => `<tr><td>${i.name}:  </td><td>${i.value}</td></tr>`);

		this.#info.innerHTML = `<table>${dataStrs.join('')}</table>`;

		this.#info.classList.add('show');
	}

	hideInfo() {
		this.#info.classList.remove('show');
	}
}
customElements.define('bau-scanner', BauScanner);
