const EventEmitter = require('events');
const { CheckBox } = require('./schemas');
const { Client } = require('@notionhq/client');
const { updatedDiff } = require('deep-object-diff');
const config = require('./config.json');

class Button extends EventEmitter{
    /** 
     * @param {Client} client
     * @param {CheckBox} checkbox 
     * */
    constructor(checkbox, client, logger) {
        super();
        this.checkbox = checkbox;
        this.pressed = checkbox.checked;
        this.last_state = checkbox.pressed;
        this.client = client;
        this.logger = logger;
    };

    get pressed() {
        return this.checkbox.checked;
    };

    set pressed(v) {
        if (this.checkbox.checked !== v) {
            this.checkbox.update({ checked: v });
            this.checkbox.dump_changes(this.client, this.logger.child({ module: this.checkbox.constructor.name }))
        }
    };

    get button_name() {
        return this.checkbox.text;
    };

    set button_name(v) {
        this.checkbox.update({ text: v });
        this.checkbox.dump_changes(this.client, this.logger.child({ module: this.checkbox.constructor.name }));
    };

    get last_edited_time() {
        return this.checkbox.last_edited_time;
    };

    set last_edited_time(v) {
        throw new Error(`This property is protected`);
    };

    subscribe() {
        this.subscribtion = setInterval(this.updateState.bind(this), config.FETCHING_INTERVAL);
        return this.subscribtion;
    };

    async updateState() {
        let new_checkbox = new CheckBox(await this.checkbox.getProperties(this.client, this.logger));
        let diff = updatedDiff(this.checkbox, new_checkbox)
        diff = new CheckBox(diff ? diff.data : undefined);
        if (!diff) {
            return;
        }
        else if (!diff.last_edited_time) {
            this.checkbox = new_checkbox;
            return;
        }
        else if (typeof diff.checked !== 'undefined' && diff.checked) {
            this.checkbox = new_checkbox;
            this.logger.debug(`Sending pressed for ${this.button_name}`);
            this.emit('pressed');
            this.checkbox.update({ checked: false });
            await this.checkbox.dump_changes(this.client, this.logger.child({ module: this.checkbox.constructor.name }));
            return;
        }
        else if (typeof diff.checked !== 'undefined' && !diff.checked) {
            this.checkbox = new_checkbox;
            this.logger.debug(`Sending unpressed for ${this.button_name}`);
            this.emit('unpressed');
            return;
        }
    }

    unsubscribe() {
        if (this.subscribtion) {
            clearInterval(this.subscribtion);
        }
    }


}

module.exports = Button;