// src/engine/ProtocolSnapshotBuilder.js
class ProtocolSnapshotBuilder {
  // Persist the runtime scope directly on the snapshot so history does not mix networks.
  constructor(protocol, network = null) {
    this.snapshot = {
      protocol,
      network,
      snapshot_at: new Date(),
      collectors: {}
    };
  }

  add(result) {
    this.snapshot.collectors[result.collector] = {
      collected_at: new Date(result.collected_at),
      data: result.data,
      ...(result.error ? { error: result.error } : {})
    };
  }

  build() {
    return this.snapshot;
  }
}

export default ProtocolSnapshotBuilder;
