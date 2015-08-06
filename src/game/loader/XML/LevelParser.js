/**
 * All Y values are negated to avoid having to specify
 * everything in XML as negative.
 */
Game.Loader.XML.Parser.LevelParser = function(loader)
{
    Game.Loader.XML.Parser.call(this, loader);
    var world = new Engine.World();
    this.world = world;
    this.level = new Game.scenes.Level(loader.game, this.world);

    this.animations = {};
    this.faceAnimators = {};
    this.models = {};

    this.baseUrl = undefined;
}

Engine.Util.extend(Game.Loader.XML.Parser.LevelParser, Game.Loader.XML.Parser);

Game.Loader.XML.Parser.LevelParser.prototype.parse = function(levelNode, callback)
{
    if (!levelNode.is('scene[type=level]')) {
        throw new TypeError('Node not <scene type="level">');
    }

    var parser = this;
    var loader = parser.loader;
    var level = this.level;

    this.parseCamera(levelNode);
    this.parseGravity(levelNode);

    levelNode.find('> texture').each(function() {
        var node = $(this);
        parser.parseTexture(node);
    });

    levelNode.find('> models > model').each(function() {
        parser.parseModel($(this));
    });

    this.parseLayout(levelNode);

    levelNode.find('> checkpoints > checkpoint').each(function() {
        var checkpointNode = $(this);
        var c = parser.getVector2(checkpointNode);
        var r = parseFloat(checkpointNode.attr('radius'));
        level.addCheckPoint(c.x, c.y, r || undefined);
    });

    this.callback(this.level);
}

Game.Loader.XML.Parser.LevelParser.prototype.parseCamera = function(levelNode)
{
    var level = this.level;
    var parser = this;

    levelNode.find('> camera').each(function() {
        var cameraNode = $(this);
        var smoothing = parseFloat(cameraNode.attr('smoothing'));
        if (isFinite(smoothing)) {
            level.camera.smoothing = smoothing;
        }
    });

    levelNode.find('> camera > path').each(function() {
        var pathNode = $(this);
        var path = new Engine.Camera.Path();
        /* y1 and y2 is swapped because they are negative. */
        var windowNode = pathNode.children('window');
        path.window = parser.getRect(windowNode);

        var constraintNode = pathNode.children('constraint');
        path.constraint[0] = parser.getVector3(constraintNode, 'x1', 'y1', 'z1');
        path.constraint[1] = parser.getVector3(constraintNode, 'x2', 'y2', 'z2');

        level.camera.addPath(path);
    });
}

Game.Loader.XML.Parser.LevelParser.prototype.parseGravity = function(levelNode)
{
    var level = this.level;
    var parser = this;
    levelNode.find('> gravity').each(function() {
        var gravity = parser.getVector2(this);
        if (gravity) {
            gravity.y = -gravity.y;
            level.world.gravityForce.copy(gravity);
        }
    });
}

Game.Loader.XML.Parser.LevelParser.prototype.parseLayout = function(levelNode)
{
    var parser = this;
    var level = parser.level;

    levelNode.find('> layout').each(function() {
        var layoutNode = $(this);

        layoutNode.find('> background').each(function() {
            backgroundNode = $(this);
            var modelId = backgroundNode.attr('model');

            var background = new parser.models[modelId]();

            var position = parser.getVector2(backgroundNode);
            background.position.x = position.x + (background._size.x / 2);
            background.position.y = position.y - (background._size.y / 2);
            background.position.z = 0;

            level.world.scene.add(background.model);
        });
    });


    levelNode.find('> layout > solids').each(function() {
        var solidsNode = $(this);

        var material = new THREE.MeshBasicMaterial({
            color: 'white',
            wireframe: true,
            visible: false,
        });

        solidsNode.children().each(function(i, solidNode) {
            solidNode = $(solidNode);
            var prop = {
                'x': parseFloat(solidNode.attr('x')),
                'y': parseFloat(solidNode.attr('y')),
                'w': parseFloat(solidNode.attr('w')),
                'h': parseFloat(solidNode.attr('h')),
            }

            /* Put code to calculated collisionradius needed somehow here
            var c2 = collisionRadius * 2;
            if (prop.w > c2 || prop.h > c2) {
                console.error('Solid beyond collision radius %f.', collisionRadius, prop);
            }
            */

            var geometry = new THREE.PlaneGeometry(prop.w, prop.h);

            var solid = new Game.objects.Solid();
            solid.position.x = prop.x + (prop.w / 2);
            solid.position.y = -(prop.y + (prop.h / 2));
            solid.addCollisionGeometry(geometry);

            var attackNodes = solidNode.find('> attack');
            if (attackNodes.length) {
                solid.attackAccept = [];
                attackNodes.each(function(i, attackNode) {
                    var direction = $(attackNode).attr('direction');
                    solid.attackAccept.push(solid[direction.toUpperCase()]);
                });
            }

            level.world.addObject(solid);
        });
    });

    return;

    layoutNode.find('enemies > enemy').each(function(i, enemyNode) {
        enemyNode = $(enemyNode);

        var id = enemyNode.attr('id');
        if (loader.game.resource.items.character[id]) {
            objectRef = loader.game.resource.items.character[id];
        }
        else {
            var name = enemyNode.attr('name');
            if (!Game.objects.characters[name]) {
                throw new Error('Item ' + name + ' does not exist');
            }
            objectRef = Game.objects.characters[name];
        }

        var spawnNode = enemyNode.find('> spawn');
        var x = parseFloat(enemyNode.attr('x'));
        var y = -parseFloat(enemyNode.attr('y'));
        if (spawnNode.length) {
            var object = new Game.objects.Spawner();
            object.spawnSource.push(objectRef);
            object.spawnCount = parseFloat(spawnNode.attr('count')) || undefined;
            object.maxSimultaneousSpawns = parseFloat(spawnNode.attr('simultaneous')) || 1;
            object.spawnInterval = parseFloat(spawnNode.attr('interval')) || 1;
            object.minDistance = parseFloat(spawnNode.attr('min-distance')) || object.minDistance;
            object.maxDistance = parseFloat(spawnNode.attr('max-distance')) || object.maxDistance;
        }
        else {
            var object = new objectRef();
            var direction = enemyNode.attr('direction');
            if (direction == 'right') {
                object.direction.x = object.DIRECTION_RIGHT;
            }
            else if (direction == 'left') {
                object.direction.x = object.DIRECTION_LEFT;
            }
        }

        level.world.addObject(object, x, y);
    });

    layoutNode.find('> items > item').each(function() {
        var itemNode = $(this);
        var name = itemNode.attr('name');
        if (!Game.objects.items[name]) {
            throw new Error('Item ' + name + ' does not exist');
        }
        var Item = new Game.objects.items[name]();
        Item.model.position.x = parseFloat(itemNode.attr('x'));
        Item.model.position.y = -parseFloat(itemNode.attr('y'));
        scene.addObject(Item);
    });

    layoutNode.find('obstacles > obstacle').each(function(i, obstacleNode) {
        obstacleNode = $(obstacleNode);
        var name = obstacleNode.attr('name');
        if (!Game.objects.obstacles[name]) {
            throw new Error('Obstacle ' + name + ' does not exist');
        }
        if (name == 'DestructibleWall') {
            var obstacle = new Game.objects.obstacles[name](obstacleNode.attr('color'));
            obstacle.model.position.x = parseFloat(obstacleNode.attr('x'));
            obstacle.model.position.y = -parseFloat(obstacleNode.attr('y'));
        }
        else if (name == 'DeathZone') {
            var obstacle = new Game.objects.obstacles[name]();
            var prop = {
                'x': parseFloat(obstacleNode.attr('x')),
                'y': parseFloat(obstacleNode.attr('y')),
                'w': parseFloat(obstacleNode.attr('w')),
                'h': parseFloat(obstacleNode.attr('h')),
            };
            obstacle.addCollisionRect(prop.w, prop.h);
            obstacle.model.position.x = prop.x + (prop.w/2);
            obstacle.model.position.y = -(prop.y + (prop.h/2));
        }
        else {
            var obstacle = new Game.objects.obstacles[name]();
            var ref = obstacleNode.attr('ref');
            var object = getObject(ref);
            var material = new THREE.MeshBasicMaterial();
            material.map = object.texture;
            material.side = THREE.DoubleSide;
            var model = new THREE.Mesh(object.geometry, material);
            obstacle.setModel(model);
            obstacle.addCollisionRect(object.size.w, object.size.h);
            obstacle.model.position.x = parseFloat(obstacleNode.attr('x'));
            obstacle.model.position.y = -parseFloat(obstacleNode.attr('y'));
        }

        level.world.addObject(obstacle);
    });

    /* FOR MERGING
    //var levelGeometry = new THREE.Geometry();
        //mesh.updateMatrix();
        //levelGeometry.merge(mesh.geometry, mesh.matrix);
    //var levelMesh = new THREE.Mesh(levelGeometry, new THREE.MeshFaceMaterial(materials));
    //level.level.add(levelMesh);
    */
    layoutNode.find('objects > object').each(function(i, objectNode) {
        objectNode = $(objectNode);

        var ref = objectNode.attr('ref');
        var object = getObject(ref);

        var material = new THREE.MeshBasicMaterial();
        material.map = object.texture;
        material.side = THREE.DoubleSide;

        //materials.push(spriteIndex[id].material);
        var rangeX = parser.getRange(objectNode, 'x');
        var rangeY = parser.getRange(objectNode, 'y');

        for (var i in rangeX) {
            var mesh = new THREE.Mesh(object.geometry, material);
            mesh.position.x = rangeX[i] + (object.size.w / 2);
            mesh.position.y = -(rangeY[i] + (object.size.h / 2));
            level.world.scene.add(mesh);
        }

        var rotate = parseFloat(objectNode.attr('rotate'));
        if (isFinite(rotate)) {
            mesh.rotation.z = -(Math.PI/180)*rotate;
        }

        var flip = objectNode.attr('flip');
        if (flip == 'x') {
            mesh.scale.x = -1;
        }
        if (flip == 'y') {
            mesh.scale.y = -1;
        }
    });
}

Game.Loader.XML.Parser.LevelParser.prototype.parseModel = function(modelNode)
{
    var parser = this;

    var modelId = modelNode.attr('id');
    var geometryNode = modelNode.find('> geometry');
    var geometry = parser.getGeometry(geometryNode);
    var size = parser.getVector2(geometryNode, 'w', 'h');
    var segs = parser.getVector2(geometryNode, 'w-segments', 'h-segments');

    var textures = [];
    var faceAnimators = parser.faceAnimators;

    modelNode.find('> tile').each(function() {
        var tileNode = $(this);
        var tileId = tileNode.attr('id');
        var offset = parseFloat(tileNode.attr('offset')) || 0;
        var animation = parser.animations[tileId];

        tileNode.find('> face').each(function() {
            var faceNode = $(this);

            var animationId = faceNode.attr('id');
            var animation = parser.animations[animationId].animation;

            if (!faceAnimators[animationId]) {
                var animator = new Engine.Animator.UV();
                animator.update = animator.update.bind(animator);
                animator.setAnimation(animation);
                if (animation.frames > 1) {
                    var world = parser.level.world;
                    world.events.bind(world.EVENT_UPDATE, animator.update);
                }
                faceAnimators[animationId] = animator;
            }
            else {
                var animator = faceAnimators[animationId];
            }

            textures.push(parser.animations[animationId].texture);
            animator.addGeometry(geometry);

            /* If animation contains multiple frames, bind
               update function to worlds update event. */

            var range = {
                'x': parser.getRange(faceNode, 'x', segs.x),
                'y': parser.getRange(faceNode, 'y', segs.y),
            };

            animator.indices = [];

            var i, j, x, y, segIndex;
            for (i in range.x) {
                x = range.x[i] - 1;
                for (j in range.y) {
                    y = range.y[j] - 1;
                    segIndex = (x + (y * segs.x)) * 2;
                    animator.indices.push(segIndex);
                }
            }
        });
    });

    var material = new THREE.MeshBasicMaterial({
        map: textures[0],
        side: THREE.FrontSide,
    });

    var constructor = function()
    {
        this._modelId = modelId;
        this._size = size;

        this.geometry = geometry;
        this.material = material;

        var updateAnimators = function(deltaTime)
        {
            for (var i in animators) {
                animators[i].update(deltaTime);
            }
        }

        Engine.Object.call(this);

        this.bind(this.EVENT_TIMESHIFT, updateAnimators);
    }

    Engine.Util.extend(constructor, Engine.Object);

    this.models[modelId] = constructor;
}

Game.Loader.XML.Parser.LevelParser.prototype.parseTexture = function(textureNode)
{
    var parser = this;
    var textureSize = parser.getVector2(textureNode, 'w', 'h');
    var texture = parser.getTexture(textureNode);

    textureNode.find('animation').each(function() {
        var animationNode = $(this);
        var animation = new Engine.Animator.Animation();
        animationNode.find('> frame').each(function() {
            var frameNode = $(this);
            var frameOffset = parser.getVector2(frameNode, 'x', 'y');
            var frameSize = parser.getVector2(frameNode, 'w', 'h');

            var uvMap = Engine.SpriteManager.createUVMap(frameOffset.x, frameOffset.y,
                                                         frameSize.x,   frameSize.y,
                                                         textureSize.x, textureSize.y);

            var duration = parseFloat(frameNode.attr('duration')) || undefined;
            animation.addFrame(uvMap, duration);
        });
        parser.animations[animationNode.attr('id')] = {
            'animation': animation,
            'texture': texture,
            'mounted': false,
        }
    });
}
