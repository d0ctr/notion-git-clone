const YamlParser = require('js-yaml');
const { Client } = require('@notionhq/client');

let type_switcher = {
    'page': 'page',
    'database': 'database',
    'child_page': 'page',
    'child_database': 'database',
    'paragraph': 'paragraph',
    'code': 'code',
    'heading_1': 'paragraph',
    'to_do': 'to_do',
    'unsupported': 'block',
    'block': 'block'
};

let api_switcher = {
    'page' : 'pages',
    'database': 'databases',
    'paragraph': 'blocks',
    'block': 'blocks',
    'code': 'blocks',
    'to_do': 'blocks'
};

let api_name_switcher = {
    'page': 'page_id',
    'database': 'database_id',
    'paragraph': 'block_id',
    'block': 'block_id',
    'code': 'block_id',
    'to_do': 'block_id'
};

let children_param_switcher = {
    'page': 'block_id',
    'database': 'database_id',
    'paragraph': 'block_id'
};

class Block {
    constructor(data) {
        if (data) {
            this.data = data;
            this.id = this.data.id
            this.object = this.data.object;
            this.content = [];
            this.type = this.data.type in type_switcher ? type_switcher[this.data.type] : undefined;
            this.types = this.type in api_switcher ? api_switcher[this.type] : undefined;
            this.api_name = this.type in api_name_switcher ? api_name_switcher[this.type] : undefined;
            this.children_param = this.type in children_param_switcher ? children_param_switcher[this.type] : undefined;
        }
    };

    get created_time() {
        if (this.data) {
            return this.data.created_time;
        }
    };

    set created_time(v) {};

    get last_edited_time() {
        if (this.data) {
            return this.data.last_edited_time;
        }
    };

    set last_edited_time(v) {};

    /** @param {Client} client */
    async __properties_retriever(client) {
        if (this.types && this.api_name){
            return await client[this.types].retrieve({
                [this.api_name]: this.id
            });
        }
        return;
    };

    /** @param {Client} client */
    async __content_retriever(client, cursor) {
        return await client.blocks.children.list({
            block_id: this.id,
            start_cursor: cursor,
        });
    };

    /** @param {Client} client */
    async __properties_updater(client, cursor) {
        return await client.blocks.update({
            block_id: this.id,
            ...this.data
        })
    };

    
    async getProperties(client, logger) {
        try {
            let res = await this.__properties_retriever(client);
            if (!res) {
                logger.debug(`No properties for ${this.type}:${this.id}`, { object: this });
                return;
            }
            logger.debug(`Successfully fetched ${this.type}:${this.id} properties`, { object: res })
            return res;
        }
        catch (e) {
            logger.error(`Error while fetching ${this.type}:${this.id} properties`, { error: e });
        }
    };
    
    async getContent(client, logger) {
        let children = [];
        try {
            let cursor;
            while (true) {
                let res = await this.__content_retriever(client, cursor);
                if (!res) {
                    logger.debug(`No content for ${this.type}:${this.id}`, { object: this });
                    return;
                }
                children.push(...res.results);
                if (!res.next_cursor) {
                    break;
                }
                cursor = res.next_cursor;
            }
            logger.debug(`Successfully fetched ${children.length} children for ${this.type}:${this.id}.`, { object: children });
        }
        catch (e) {
            logger.error(`Error while fetching children for ${this.type}:${this.id}`, { error: e });
        }
        return children;
    };
    
    appendContent(data) {
        if (data.length) {
            for (let rawdata of data) {
                let object = this.__parseRaw(rawdata);
                this.content.push(object);
            }
        }
        else {
            let object = this.__parseRaw(data);
            this.content.push(object)
        }
    };

    __parseRaw(data) {
        let result;
        if (['Page', 'Block', 'Database', 'Text', 'Code', 'CheckBox'].indexOf(data.constructor.name) !== -1) {
            result = data;
        }
        else {
            result = new Block(data);
        }
        return result;
    };

    update(newdata) {
        for (let key in newdata) {
            if (this[key]) {
                this[key] = newdata[key];
            }
            else if(this.data && this.data[key]) {
                this.data[key] = newdata[key];
            }
        }
    };

    async dump_changes(client, logger) {
        this.__properties_updater(client).then((value) => {
            if (!value) {
                logger.error(`No response for ${this.type}:${this.id} update`, { object: this });
            }
            logger.debug(`Succesfully updated ${this.type}:${this.id}`, {object: this });
            this.update({ data: value });
        }).catch((error) => {
            logger.error(`Error while updating ${this.type}:${this.id}`, { error: e })
        });
    };
}

class Database extends Block {
    constructor(data) {
        super(data);
        if (this.data) {
            this.content = [];
        }
    };

    get title() {
        if (this.data) {
            return this.data.title[0].plain_text;
        }
    }

    set title(v) {
        if (this.data) {
            this.data.title[0] = {
                type: 'text',
                text: { content: v, link: null },
                plain_text: v
            };
        }
    }

    async __properties_retriever(client) {
        return await client.databases.retrieve({
            database_id: this.id
        });
    };

    async __content_retriever(client, cursor) {
        return await client.databases.query({
            database_id: this.id,
            start_cursor: cursor,
        });
    };
};

class Page extends Block {
    constructor(data) {
        super(data);
        if (this.data) {
            if (this.data.properties) {
                if (this.data.properties.title) {
                    this.title = this.data.properties.title.title[0].plain_text;
                }
                else if (this.data.properties.Name) {
                    this.title = this.data.properties.Name.title[0].plain_text;
                }
            }
            this.content = [];
        }
    };
    

    get title() {
        if (this.data) {
            if (this.data.properties) {
                if (this.data.properties.title) {
                    return this.data.properties.title.title[0].plain_text;
                }
                else if (this.data.properties.Name) {
                    return this.data.properties.Name.title[0].plain_text;
                }
            }
        }
    };

    set title(v) {
        if (this.data) {
            if (this.data.properties) {
                if (this.data.properties.title) {
                    this.data.properties.title.title[0] = {
                        type: 'text',
                        text: { content: v, link: null },
                        plain_text: v
                    };
                }
                else if (this.data.properties.Name) {
                    return this.data.properties.Name.title[0] = {
                        type: 'text',
                        text: { content: v, link: null },
                        plain_text: v
                    };;
                }
            }
        }
    };

    async __properties_retriever(client) {
        return await client.pages.retrieve({
            page_id: this.id
        });
    };
};

class Text extends Block {
    constructor(data) {
        super(data);
        
    }

    get text() {
        if (this.data) {
            if (this.data[this.data.type].text.length) {
                return this.__getAllText(this.data[this.data.type].text);
            }
        }
    }

    set text(v) {
        if (this.data) {
            this.data[this.data.type].text = [{
                type: 'text',
                text: { content: v, link: null },
                plain_text: v
            }]
        }
    }

    __getAllText(textArray) {
        let text = '';
        for (let textEntry of textArray) {
            if (textEntry.type === 'text') {
                text += textEntry.plain_text;
            }
        }
        return text;
    }
};

class Code extends Block {
    constructor(data) {
        super(data);
    };

    get language() {
        if (this.data.code) {
            return this.data.code.language;
        }
    };

    set language(v) {
        if (this.data.code) {
            this.data.code.language = v;
        }
    };

    get code() {
        if (this.data.code) {
            switch (this.language.toLowerCase()) {
                case 'yaml':
                    return YamlParser.load(this.data.code.text[0].plain_text);
                    break;
                case 'json':
                    return JSON.parse(this.data.code.text[0].plain_text);
            };
        }
    };

    set code(v) {
        if (this.data.code) {
            switch (this.language.toLowerCase()) {
                case 'yaml':
                    this.data.code.text[0].plain_text = YamlParser.dump(v);
                    break;
                case 'json':
                    this.data.code.text[0].plain_text = JSON.stringify(v);
            };
        }
    }
};

class CheckBox extends Text {
    constructor(data) {
        super(data);
    }

    get checked() {
        if (this.data && this.data['to_do']) {
            return this.data['to_do'].checked;
        }
    }

    set checked(v) {
        if (this.data && this.data['to_do']) {
            this.data['to_do'].checked = v;
        }
    }
}

module.exports = { Block, Page, Database, Text, Code, CheckBox }