// Updated Partner interface and modified Cari interface

export interface Partner {
    id: string;
    name: string;
    // Add other relevant fields here
}

export interface Cari {
    id: string;
    name: string;
    ortak: boolean;
    partnerId?: string;
    // Add other relevant fields here
}

export interface DB {
    partners: Partner[];
    // Other fields in the DB interface
}