import { Collection, ObjectId } from 'mongodb';
import { Database } from '../../Database';
import { Cache } from '../../../util/Cache';
import { createHash } from '../../../util/Functions';
export class UserSettings {

    public db: Database;
    public collection: Collection<any>;
    public cache: Cache<string, any>;

    constructor(
        db: Database,
        collection: Collection<any>
    ) {

        this.db = db;
        this.collection = collection;

        this.cache = new Cache<string, any>();
    }

    async fetch(userID: string): Promise<any> {
        return this.cache.get(userID) ||
            await this.collection.findOne({ userID }) ||
            await this.create(userID);
    }



    async update<K extends keyof any>({
        userID,
        guildID,
        key,
        data
    }: {
        userID: string;
        key: K;
        guildID?: string;
        data: any[K];
    }): Promise<any | null> {

        let cached: any = this.cache.get(userID) || await this.collection.findOne({ userID }) as any;

        if (!cached) {
            cached = await this.create(userID, guildID);
        }

        cached[key] = data;

        const r = await this.collection.updateOne({ userID }, { $set: cached }).then((val) => {
            if (val.modifiedCount === 1) {
                this.cache.set(userID, cached);
                return true;
            } else {
                return false;
            }
        });

        if (r) return cached;
        return null;

    }



    async create(userID: string, guildID = 'GLOBAL'): Promise<any> {

        const existing = this.cache.get(userID) || await this.collection.findOne({ userID });

        if (existing) {
            return existing;
        }

        const data: any = {
            bonkedCount: 0,
            selfVotebannedCount: 0,
            userID,
            economy: {
                profile: {
                    details: '',
                    userID
                },
                accounts: [],
                cash: 0,
                mainAccount: {
                    accountID: createHash(`${userID}:${guildID}`),
                    accountNumber: 0,
                    bankID: guildID,
                    idHash: createHash(`${userID}:${guildID}`),
                    tax: {
                        income: 0.1,
                        keeping: 0.001,
                        outgoing: 0.1
                    },
                    vault: 50_000
                }
            },
            voteBannedCount: 0,
        };

        const r = await this.collection.insertOne(data);

        if (r.insertedCount === 1) {
            return {
                ...data
            };
        }
        throw new Error('could not update the database');
    }



    async init(): Promise<void> {

        if (this.cache.size) this.cache.clear();
        const entries = await this.collection.find().toArray();
        for (const entry of entries) {
            this.cache.set(entry.userID, entry);
        }
        this.db.client.logger.log('successfully inited the user settings');
    }

}
