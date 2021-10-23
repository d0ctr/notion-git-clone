const { Page, Database, Block, Text, Code, CheckBox }  = require('./schemas');

class TreeResolver {
    constructor(client, logger = console) {
        this.client = client;
        this.logger = logger;
    };

    async resolveTree(id) {
        this.logger.debug(`Resolving tree for ${id}`);
        let raw_block;
        let block;
        try {
            raw_block = await this.getBlock(id);
            block = new Block(raw_block);
        }
        catch (e) {
            this.logger.error(`Error while creating block ${id}`, { error: e });
            return;
        }

        let object;
        try {
            object = await block.getProperties(this.client, this.logger.child({ module: 'Block' }));
            if (!object) {
                this.logger.error(`No properties for ${block.type} ${block.id}`);
                return;
            }
        }
        catch (e) {
            this.logger.error(`Error while acquiring properties for ${block.type} ${block.id}`, { error: e });
            return;
        }

        try {
            switch (block.type) {
                case 'page':
                    object = new Page(object);
                    break;
                case 'database':
                    object = new Database(object);
                    break;
                case 'paragraph':
                    object = new Text(object);
                    break;
                case 'code':
                    object = new Code(object);
                    break;
                case 'to_do':
                    object = new CheckBox(object);
                    break;
                default:
                    object = block;
                    break;
            }
        }
        catch (e) {
            this.logger.error(`Error while creating an instance of a class for ${block.type} ${block.id}`, { error: e, object: object });
            return;
        }

        let content;
        try {
            content = await object.getContent(this.client, this.logger.child({ module: object.constructor.name }));
            if (!content || !content.length) {
                this.logger.debug(`No content for ${block.type}:${block.id}`);
                return object;
            }
        }
        catch (e) {
            this.logger.error(`Error while acquiring children for ${block.type} ${block.id}`, { error: e });
            return object;
        }

        for (let entry of content) {
            let child;
            try {
                child = await this.resolveTree(entry.id);
                if (!child) {
                    this.logger.debug(`No child for ${object.title}:${object.id}`);
                    continue;
                }
                this.logger.debug(`Appending child to ${object.title}:${object.id}`, { object: child })
                object.appendContent(child);
            }
            catch (e) {
                this.logger.error(`Error while resolving child ${entry.id} for ${block.type} ${block.id}`, { error: e, object: child });
                continue;
            }
        }
        this.logger.debug(`Successfully fetched all children for ${object.title}:${object.id}`, { object: object })
        return object;
    };

    async getBlock(id) {
        try {
            let res = await this.client.blocks.retrieve({
                block_id: id
            });
            this.logger.debug(`Successfully fetched block ${id} properties`, { object: res })
            return res;
        }
        catch (e) {
            this.logger.error(`Error while fetching block ${id} properties`, { error: e });
        }
    };

    async treeSearcher(tree, text) {
        let result;
        if (tree && tree.text && tree.text === text) {
            this.logger.debug(`Found ${tree.type || tree.object} ${tree.text}`, { object: tree });
            return tree;
        }
        if (tree &&  tree.tile && tree.title === text) {
            this.logger.debug(`Found ${tree.type || tree.object} ${tree.title}`, { object: tree });
            return tree;
        }
        for (let branch in tree) {
            if (typeof tree[branch] === 'object' && branch !== 'data') {
                result = await this.treeSearcher(tree[branch], text);
                if (result) {
                    return result;
                }
            }
        }
        return result;
    }
}

module.exports = TreeResolver;