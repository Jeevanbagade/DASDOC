import type { FileKind } from "@/lib/files";
import type { ColorMode } from "@/lib/pricing";

/** A document that has been uploaded to the server and priced into the order. */
export interface WizardDoc {
  id: string;
  name: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  pageCountEstimated: boolean;
  copies: number;
  colorMode: ColorMode;
  /** object URL for local image previews */
  previewUrl?: string;
}

export interface InFlightUpload {
  tempId: string;
  name: string;
  sizeBytes: number;
}

export interface RejectedFile {
  id: string;
  name: string;
  message: string;
}

export interface AddressForm {
  fullName: string;
  mobile: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

export const EMPTY_ADDRESS: AddressForm = {
  fullName: "",
  mobile: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  landmark: "",
};

export type PaymentState = {
  method: "upi" | "cod";
  upiId: string;
};
