const fs = require('fs');

class ConfigurationEditor {
    constructor(name = './user.conf', logger = console) {
        this.name = name;
        this.logger = logger;
        this.field = {};
        this.__read();
    }
    /**
     * @param {string} property 
     */
    get(property) {
        property = property.toUpperCase();
        if (!this.field[property]) {
            this.__read();
            if(!this.field[property]) {
                return;
            }
            return this.get(property);
        }
        return this.field[property];
    }

    /**
     * @param {string} property 
     * @param {any} value 
     */
    set(property, value) {
        property = property.toUpperCase()
        this.field[property] = value;
        this.__dump();
        return this.field[property];
    }

    __dump() {
        let data = '';
        for(let name in this.field) {
            data += name + '=' + String(this.field[name]) + '\n';
        }
        fs.writeFileSync(this.name, data);
    }

    __read() {
        try {
            let data = fs.readFileSync(this.name, 'utf8');
            data = data.split('\n');
            for (let line of data) {
                let indexOfSeparator = line.indexOf('=');
                let property = line.slice(0,indexOfSeparator);
                let value = line.slice(indexOfSeparator + 1);
                this.field[property] = value;
            }
        }
        catch (e) {
            this.logger.error('Error reading from file (it may not present)');
            this.logger.debug('Error: ', e);
        }
    }
}

module.exports = ConfigurationEditor;