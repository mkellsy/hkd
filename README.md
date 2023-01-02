# Homebridge Sandbox

This is a utility to run Homebridge plugins in sandboxes. This prevents plugins from doing too much damage on the system.

This also changes the config files to YAML. It also prevents plugins from accessing the config file. This prevents plugins from seeing sensitive data for other plugins.

## Usage
This is not an easy way to setup Homebridge. It is completly CLI based and the official Homebridge UI will not work with this. If you are a Homebridge fan, please use [Homebridge](https://www.npmjs.com/package/homebridge). If you are not confortable editing YAML files and using the command line, use [Homebridge](https://www.npmjs.com/package/homebridge).

Basically this utility has NO support. I wrote this to handge my setup and it is not intended for anything else. Use at your own risk.

## Plugin Support
You can install Homebridge plugins. However, not all plugins will work with this. It does load and run plugins very differently. The plugins run inside a NodeJS VM, and has no access to the system. It only has access to the network and a Homebridge instance. If the plugin tries to use anything outside of the Homebridge API, it will fail.

Again, use at your own risk.

## Support
How can I get support for this? You will get NO support for this. The Homebridge community most likely will not help you either. If you find yourself needing support, it is best to use the official [Homebridge](https://www.npmjs.com/package/homebridge) image. This is not intended to make things easy. It is intended to make things more secure.

## Install
Install from NPM
```
sudo npm -g install hkd
```

Uninstall
```
sudo npm -g uninstall hkd
```

## CLI
Setup the service
```
sudo hkd service install
```

Remove the service
```
sudo hkd service uninstall
```

Restart the service
```
sudo hkd service restart
```

View the log
```
sudo hkd log
```

View bridges
```
sudo hkd bridge list
```

Add a bridge
```
sudo hkd bridge create
```

Remove a bridge
```
sudo hkd bridge remove
```

Pair a bridge with HomeKit
```
sudo hkd bridge pair
```

List installed plugins
```
sudo hkd plugin list
```

Install a plugin
```
sudo hkd plugin install [plugin name]
```

Uninstall a plugin
```
sudo hkd plugin uninstall [plugin name]
```

Configure a hub/bridge/plugin
```
sudo hkd config
```

Start the service
```
sudo hkd start
```

> If running on Windows, omit `sudo`