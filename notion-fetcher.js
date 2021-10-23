const config = require('./config.json');
const { Client } = require('@notionhq/client');
const EventEmitter = require('events');
const ConfigurationEditor = require('./configuration-editor');
const { Page } = require('./schemas')
const TreeResolver = require('./tree-resolver');
const Button = require('./buttons');

class NotionFetcher extends EventEmitter {
    constructor(logger = console) {
        super();
        this.logger = logger;

        /** @type {Client} */
        this.client = this.createNotionClient();
        /** @type {ConfigurationEditor} */
        this.user_config = new ConfigurationEditor();
        /** @type {Page} */
        this.root_tree = new Page();
        /** @type {TreeResolver} */
        this.tree_resolver = new TreeResolver(this.client, this.logger.child({ module: 'TreeResolver' }))
    };

    async fetchFullTree() {
        let root_page = await this.getRootPage();
        this.root_tree = await this.tree_resolver.resolveTree(root_page.id);
        this.emit('fetched root');
    };

    createNotionClient() {
        this.client = new Client({
            auth: config.NOTION_TOKEN
        })
        return this.client;
    };

    async getRootPage() {
        let root_page_id = this.user_config.get('root_page_id');
        let root_page;

        if(!root_page_id) {
            let search_result;
            try {
                search_result = await this.client.search({
                    query: config.ROOT_PAGE_NAME
                });
            }
            catch (e) {
                this.logger.error(`Error while searching for the root page with <${config.ROOT_PAGE_NAME}> name.`, {error: e});
                return;
            }
            
            if (!search_result.results.length) {
                this.logger.error(`No root pages with <${config.ROOT_PAGE_NAME}> name were found.`);
                return;
            }
            else if (search_result.results.length > 1) {
                this.logger.error(`There are multiple pages with root page name <${config.ROOT_PAGE_NAME}> in the title.`);
                return; 
            }
            root_page = search_result.results[0]
        }
        else {
            try {
                root_page = await this.client.pages.retrieve({
                    page_id: root_page_id
                });
            }
            catch (e) {
                this.logger.error(`Error while fetching root page with <${config.ROOT_PAGE_NAME}> name.`, {error: e});
                return;
            }
        }
        

        let result = new Page(root_page);
        this.user_config.set('root_page_id', result.id);
        this.logger.debug('Successfully fetched root page', { object: result });
        return result;
    };

    async findObject(name) {
        let object = await this.tree_resolver.treeSearcher(this.root_tree, name);
        if (object) {
            this.logger.debug(`Found ${object.type || object.object} ${object.title || object.text}`, { object: object });
            return object;
        }
        return;
    };

    async getRunButton() {
        let object = await this.findObject(config.RUN_BUTTON_NAME);
        if (object) {
            return new Button(object, this.client, this.logger.child({ module: 'RUN_BUTTON' }));
        }
    };

    async getClearButton() {
        let object = await this.findObject(config.CLEAR_BUTTON_NAME);
        if (object) {
            return new Button(object, this.client, this.logger.child({ module: 'CLEAR_BUTTON_NAME' }));
        }
    };
}

module.exports = NotionFetcher;