import {
  appendOnlyContract,
  counterContract,
  keyValueContract,
  repositoryContract,
} from "./testing/contracts";
import {
  InMemoryAppendOnlyStore,
  InMemoryCounterStore,
  InMemoryKeyValueStore,
  InMemoryRepository,
} from "./stores";

repositoryContract("in-memory", () => new InMemoryRepository());
appendOnlyContract("in-memory", () => new InMemoryAppendOnlyStore());
counterContract("in-memory", () => new InMemoryCounterStore());
keyValueContract("in-memory", () => new InMemoryKeyValueStore());
