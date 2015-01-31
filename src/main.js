var renderer = new THREE.WebGLRenderer();
renderer.setSize(800, 532);
document.body.appendChild(renderer.domElement);

var Game = new Engine(renderer);
Game.timer = new Engine.Timer();

var weapons = {
	'p': new Engine.assets.weapons.Plasma(),
	'm': new Engine.assets.weapons.MetalBlade(),
	'c': new Engine.assets.weapons.CrashBomb()
};

var weaponIndex = [];
weaponIndex.selected = 0;
for (var c in weapons) {
	weaponIndex.push(weapons[c]);
}


var player = new Engine.assets.objects.characters.Megaman();
player.lifes = 0;
player.equipWeapon(weapons['p']);

var boss = new Engine.assets.objects.characters.Metalman();
boss.equipWeapon(new Engine.assets.weapons.MetalBlade());
//Game.run();

var keyboard = new Engine.Keyboard();

keyboard.intermittent(65, function() { player.moveLeftStart(); }, function() { player.moveLeftEnd(); });
keyboard.intermittent(68, function() { player.moveRightStart(); }, function() { player.moveRightEnd(); });
keyboard.intermittent(80, function() { player.jumpStart(); }, function() { player.jumpEnd(); });
keyboard.hit(79, function() { player.fire(); });
keyboard.hit(89, function() {
	if (Game.isRunning) {
		Game.pause();
	} else {
		Game.run();
	}
});

keyboard.hit(33, function() {
	player.equipWeapon(weaponIndex[++weaponIndex.selected]);
});
keyboard.hit(34, function() {
	player.equipWeapon(weaponIndex[--weaponIndex.selected]);
});
/*
keyboard.intermittent(65, function() { boss.moveLeftStart(); }, function() { boss.moveLeftEnd(); });
keyboard.intermittent(68, function() { boss.moveRightStart(); }, function() { boss.moveRightEnd(); });
keyboard.intermittent(86, function() { boss.jumpStart(); }, function() { boss.jumpEnd(); });
keyboard.hit(67, function() { boss.fire(); });
*/

Engine.scenes.Level.Util.loadFromXML('levels/flashman/Flashman.xml', function(level) {
	level.addPlayer(player);
	//level.addObject(boss, 300, -100);
	Game.scene = level;
	Game.run();
});
