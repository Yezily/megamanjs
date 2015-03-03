Engine.Collision = function()
{
    this.objects = [];
    this.positionCache = [];
}

Engine.Collision.prototype.addObject = function(object)
{
    if (object instanceof Engine.assets.Object !== true) {
        throw new Error('Collidable wrong type');
    }
    this.objects.push(object);
    this.positionCache.push(undefined);
}

Engine.Collision.prototype.removeObject = function(object)
{
    var i = this.objects.indexOf(object);
    if (i > -1) {
        this.objects[i] = undefined;
    }
}

Engine.Collision.prototype.objectNeedsRecheck = function(objectIndex)
{
    if (this.positionCache[objectIndex]
    && this.positionCache[objectIndex].equals(this.objects[objectIndex].model.position)) {
        return false;
    }
    this.positionCache[objectIndex] = undefined;
    return true;
}

Engine.Collision.prototype.detect = function()
{
    var collisionCount = 0;
    var i, j, l = this.objects.length;

    for (i = 0; i < l; i++) {
        if (this.objects[i] === undefined) {
            continue;
        }

        if (!this.objectNeedsRecheck(i)) {
            continue;
        }

        for (j = 0; j < l; j++) {
            if (i == j) {
                continue;
            }

            if (!this.objects[i] || !this.objects[j]) {
                continue;
            }

            if (this.objectsCollide(this.objects[i], this.objects[j])) {
                collisionCount++;
            }
        }
    }

    l = this.objects.length;
    for (i = 0; i < l; i++) {
        if (this.objects[i] === undefined) {
            this.objects.splice(i, 1);
            this.positionCache.splice(i, 1);
            l = this.objects.length;
            i--;
            continue;
        }

        if (this.positionCache[i] === undefined) {
            this.positionCache[i] = this.objects[i].model.position.clone();
        }
    }

    return collisionCount;
}

Engine.Collision.prototype.objectsCollide = function(o1, o2)
{
    var i, j, z1, z2,
        l = o1.collision.length,
        m = o2.collision.length;

    for (i = 0; i < l; i++) {
        z1 = o1.collision[i];
        for (j = 0; j < m; j++) {
            z2 = o2.collision[j];
            if (this.zonesCollide(o1, z1, o2, z2)) {
                //o1.collides.call(o1, o2, z1, z2);
                o2.collides.call(o2, o1, z2, z1);
                return true;
            }
        }
    }
    return false;
}

Engine.Collision.prototype.zonesCollide = function(object1, zone1, object2, zone2)
{
    var pos = [
        object1.model.position.clone().add(zone1.position),
        object2.model.position.clone().add(zone2.position)
    ];

    var geo = [
        zone1.geometry,
        zone2.geometry
    ];

    if (geo[0] instanceof THREE.CircleGeometry && geo[1] instanceof THREE.CircleGeometry) {
        return this.circlesIntersect(geo[0].boundingSphere.radius, geo[1].boundingSphere.radius,
            pos[0].x, pos[1].x, pos[0].y, pos[1].y);
    }
    else if (geo[0] instanceof THREE.PlaneGeometry && geo[1] instanceof THREE.PlaneGeometry) {
        var rect = [
            this.convertPlaneToRectangle(geo[0]),
            this.convertPlaneToRectangle(geo[1]),
        ];
        return this.rectanglesIntersect(
            pos[0].x, pos[0].y, rect[0].w, rect[0].h,
            pos[1].x, pos[1].y, rect[1].w, rect[1].h);
    }
    else {
        if (geo[0] instanceof THREE.PlaneGeometry) {
            geo = [geo[1], geo[0]];
            pos = [pos[1], pos[0]];
        }
        return this.circleInRectangle(geo[0].boundingSphere.radius, pos[0].x, pos[0].y,
            pos[1].x, pos[1].y,
            Math.abs(geo[1].vertices[0].x - geo[1].vertices[1].x),
            Math.abs(geo[1].vertices[1].y - geo[1].vertices[3].y));
    }
    return false;
}

Engine.Collision.prototype.circlesIntersect = function(r1, r2, x1, x2, y1, y2)
{
    var dx = x2 - x1;
    var dy = y2 - y1;
    var radii = r1 + r2;
    if (dx * dx + dy * dy < radii * radii) {
        return true;
    }
    return false;
}

Engine.Collision.prototype.circleInRectangle = function(r, x, y, a, b, w, h)
{
    var circle = {
        x: Math.abs(x - a),
        y: Math.abs(y - b),
    }

    if (circle.x > (w / 2 + r) || circle.y > (h / 2 + r)) {
        return false;
    }

    if (circle.x <= (w / 2) || circle.y <= (h / 2)) {
        return true;
    }

    var cornerDistanceSq = Math.pow(circle.x - w / 2, 2) +
                           Math.pow(circle.y - h / 2, 2);

    if (cornerDistanceSq <= Math.pow(r, 2)) {
        return true;
    }

    return false;
}

Engine.Collision.prototype.rectanglesIntersect = function(x1, y1, w1, h1, x2, y2, w2, h2)
{
    w1 /= 2;
    w2 /= 2;
    h1 /= 2;
    h2 /= 2;
    if (x1 + w1 > x2 - w2 && x1 - w1 < x2 + w2 &&
        y1 + h1 > y2 - h2 && y1 - h1 < y2 + h2) {
        return true;
    }
    //console.log(x1, y1, w1, h1, x2, y2, w2, h2);
    return false;
}

Engine.Collision.prototype.convertPlaneToRectangle = function(geometry)
{
    return {
        'w': Math.abs(geometry.vertices[0].x - geometry.vertices[1].x),
        'h': Math.abs(geometry.vertices[1].y - geometry.vertices[3].y),
    }
}

Engine.Collision.BoundingBox = function(model, zone)
{
    this.model = model;
    this.zone = zone;

    this.x = undefined;
    this.y = undefined;
    this.w = undefined;
    this.h = undefined;
    this.l = undefined;
    this.r = undefined;
    this.t = undefined;
    this.b = undefined;

    this.updateBoundingBox();
}

Engine.Collision.BoundingBox.prototype.bottom = function(value)
{
    this.model.position.y = value - (this.zone.position.y - (this.h / 2));
}

Engine.Collision.BoundingBox.prototype.left = function(value)
{
    this.model.position.x = value - (this.zone.position.x - (this.w / 2));
}

Engine.Collision.BoundingBox.prototype.right = function(value)
{
    this.model.position.x = value - (this.zone.position.x + (this.w / 2));
}

Engine.Collision.BoundingBox.prototype.top = function(value)
{
    this.model.position.y = value - (this.zone.position.y + (this.h / 2));
}

Engine.Collision.BoundingBox.prototype.updateBoundingBox = function()
{
    this.x = this.model.position.x + this.zone.position.x;
    this.y = this.model.position.y + this.zone.position.y;
    this.w = this.zone.geometry.parameters.width;
    this.h = this.zone.geometry.parameters.height;
    this.l = this.x - (this.w / 2);
    this.r = this.x + (this.w / 2);
    this.t = this.y + (this.h / 2);
    this.b = this.y - (this.h / 2);
}
