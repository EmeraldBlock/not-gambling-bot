/* eslint-disable */

// specifying types of some stuff

declare module "discord.js" {
    interface Collection<K, V> {
        // adds type-narrowing
        /**
         * Identical to
         * [Array.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter),
         * but returns a Collection instead of an Array.
         * @param {Function} fn The function to test with (should return boolean)
         * @param {*} [thisArg] Value to use as `this` when executing function
         * @returns {Collection}
         * @example collection.filter(user => user.username === 'Bob');
         */
        filter<U extends V>(fn: (value: V, key: K, collection: this) => value is U): Collection<K, U> & this;
        filter<T, U extends V>(fn: (this: T, value: V, key: K, collection: this) => value is U, thisArg: T): Collection<K, U> & this;
    }

    interface TextBasedChannelFields {
        // see below
        createMessageCollector(filter: MessageCollectorFilter, options?: MessageCollectorOptions): MessageCollector;
    }

    // specifies parameter types of filters for MessageCollectors
    type MessageCollectorFilter = (message: Message, collection: MessageCollector["collected"]) => boolean | Promise<boolean>;

    type MessageChannel = Message["channel"];
}
