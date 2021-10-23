const ConfigurationEditor = require('../configuration-editor');
const fs = require('fs');

describe('Test ConfigurationEditor w file', () => {
    beforeAll(() => {
        fs.writeFileSync('./test/test.user.conf', 'TEST=VALUE\n')
    });

    afterAll(() => {
        fs.rmSync('./test/test.user.conf');
    });

    test('Test initialization', () => {
        const user_config = new ConfigurationEditor('./test/test.user.conf');
        expect(user_config.field['TEST']).toBe('VALUE');
    });

    test('Test reading existing property', () => {
        const user_config = new ConfigurationEditor('./test/test.user.conf');
        expect(user_config.get('test')).toBe('VALUE');
    });

    test('Test reading non-existing property', () => {
        const user_config = new ConfigurationEditor('./test/test.user.conf');
        expect(user_config.get('notest')).toBeUndefined();
    });

    test('Test writing', () => {
        const user_config = new ConfigurationEditor('./test/test.user.conf');
        expect(user_config.set('notest', 'test')).toBe('test');
        expect(user_config.get('notest')).toBe('test');

        const reading_config = new ConfigurationEditor('./test/test.user.conf');
        expect(reading_config.get('notest')).toBe('test');
    });
});

describe('Test ConfigurationEditor w/o file', () => {
    afterAll(() => {
        try {
            fs.rmSync('./test/bad.config');
        }
        catch (e) {
            if (e.errno != -2) {
                throw e;
            }
        }
    });

    test('Test initialization', () => {
        const user_config = new ConfigurationEditor('./test/bad.config');
        expect(user_config.field).toEqual({});
    });

    test('Test reading non-existing property', () => {
        const user_config = new ConfigurationEditor('./test/bad.config');
        expect(user_config.get('notest')).toBeUndefined();
    });

    test('Test writing', () => {
        const user_config = new ConfigurationEditor('./test/bad.config');
        expect(user_config.set('notest', 'test')).toBe('test');
        expect(user_config.get('notest')).toBe('test');

        const reading_config = new ConfigurationEditor('./test/bad.config');
        expect(reading_config.get('notest')).toBe('test');
    });
});