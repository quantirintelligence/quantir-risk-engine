export class AddressRegistry {
    constructor(config) {
        this.protocolContracts = new Set(config.protocolContracts || []);
        this.whales = new Set(config.whales || []);
        this.owners = new Set(config.owners || []);
    }

    isWhale(addr) {
        return this.whales.has(addr?.toLowerCase());
    }

    isOwner(addr) {
        return this.owners.has(addr?.toLowerCase());
    }

    isProtocolContract(addr) {
        return this.protocolContracts.has(addr?.toLowerCase());
    }
}