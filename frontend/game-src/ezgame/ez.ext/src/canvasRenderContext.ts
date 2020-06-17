namespace ez {
	/**
	 * 创建canvas渲染上下文
	 * 	如果想在引擎中支持canvas渲染模式，则需要在工程中包含此文件
	 */
	ez.createCanvasRenderContext = function(): IRenderContextCanvas {
		var _ctx: CanvasRenderingContext2D;
		var _canvas: HTMLCanvasElement;
		var _width: number;
		var _height: number;
		var _alpha = 1;
		var _fill: any;
		var _blendMode: BlendMode;
		var _transform: Matrix;
		var _clips: Array<Rect>;
		var _currClip: Rect;
		var _font: string;
		var profile: CanvasPerFrameProfiler = null;
		var CompositeOperation = ["source-over", "lighter", "copy", "darker", "multiply"];

		function toMatrix(transform:Handle):Matrix {
			var t = ezasm.handleToFloatArray(transform, 6);
			return new Matrix(t[0], t[1], t[2], t[3], t[4], t[5]);
		}

		function setTransform(t: Matrix, force?: boolean): boolean {
			var r = force || ((Math.abs(t._12) + Math.abs(t._21)) > 0.00001 || t._11 < 0 || t._22 < 0);
			if(!r) {
				if(_transform) {
					if(PROFILING && profile)
						profile.transfromChange++;
					//if (PerformanceCounter)
					//	PerformanceCounter.setTransfromCount++;
					_ctx.setTransform(1, 0, 0, 1, 0, 0);
					_transform = null;
				}
			}
			else {
				_transform = t.clone();
				if(PROFILING && profile)
					profile.transfromChange++;
				//if (PerformanceCounter)
				//	PerformanceCounter.setTransfromCount++;
				_ctx.setTransform(t._11, t._12, t._21, t._22, t.tx, t.ty);
			}
			return r;
		}
		function setTransform2(t: Matrix): boolean {
			var r = (Math.abs(t._11 - 1) + Math.abs(t._22 - 1) + Math.abs(t._12) + Math.abs(t._21) > 0.000001);
			if(!r) {
				if(_transform) {
					if(PROFILING && profile)
						profile.transfromChange++;
					//if (PerformanceCounter)
					//	PerformanceCounter.setTransfromCount++;
					_ctx.setTransform(1, 0, 0, 1, 0, 0);
					_transform = null;
				}
			}
			else {
				_transform = t.clone();
				if(PROFILING && profile)
					profile.transfromChange++;
				//if (PerformanceCounter)
				//	PerformanceCounter.setTransfromCount++;
				_ctx.setTransform(t._11, t._12, t._21, t._22, t.tx, t.ty);
			}
			return r;
		}
		function clipTest(x: number, y: number, w: number, h: number): boolean {
			return (x < _currClip.left && x + w < _currClip.left) ||
				(x >= _currClip.right && x + w >= _currClip.right) ||
				(y < _currClip.top && y + h < _currClip.top) ||
				(y >= _currClip.bottom && y + h >= _currClip.bottom);
		}

		function clipTest2(x: number, y: number, w: number, h: number, tranform: Matrix): boolean {
			var pts: Array<Number2> = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
			var minx = 1000000, miny = 1000000, maxx = -100000, maxy = -100000;
			for(var i = 0; i < pts.length; i++) {
				tranform.transform(pts[i]);
				minx = Math.min(minx, pts[i][0]);
				miny = Math.min(miny, pts[i][1]);
				maxx = Math.max(maxx, pts[i][0]);
				maxy = Math.max(maxy, pts[i][1]);
			}
			return maxx < _currClip.left || minx >= _currClip.right || maxy < _currClip.top || miny >= _currClip.bottom;
		}
		var RC: IRenderContextCanvas = {
			scale: 1,
			beginRender: function (target: RenderTexture, profileData?: WGLPerFrameProfiler | CanvasPerFrameProfiler) {
			_canvas = target.canvas;
			_ctx = _canvas.getContext("2d");
			_width = target.width;
			_height = target.height;
			_transform = null;
			_ctx.setTransform(1, 0, 0, 1, 0, 0);
			profile = <CanvasPerFrameProfiler>profileData;
			_fill = "";
			_alpha = 1;
			_blendMode = BlendMode.Normal;
			_ctx.globalAlpha = _alpha;
			_ctx.globalCompositeOperation = CompositeOperation[_blendMode];
			_ctx.textAlign = "left";
			_ctx.textBaseline = "top";
			_clips = [];
			_font = "";
			_currClip = new Rect(0, 0, target.width, target.height);
			_clips.push(_currClip);
			_ctx.clearRect(0, 0, _width, _height);

			//_ctx.fillStyle = "#ff00ff";
			//_ctx.fillRect(0, 0, _width, _height);
			},

			fillRect: function (w: number, h: number, transform: Handle) {
				var t = toMatrix(transform);
				//if (PerformanceCounter)
				//	PerformanceCounter.drawCount++;

				if(typeof (_fill) !== "string") {
					_transform = t.clone();
					_ctx.setTransform(t._11, t._12, t._21, t._22, t.tx, t.ty);
					if(PROFILING && profile) {
						profile.transfromChange++;
						profile.fillRect++;
						Profile.addCommand(`fillrect gradient`);
					}
					_ctx.fillRect(0, 0, w, h);
				}
				else if(setTransform(t)) {
					if(clipTest2(0, 0, w, h, t))
						return;
					if(PROFILING && profile) {
						profile.fillRect++;
						Profile.addCommand(`fillrect ${_fill}`);
					}
					_ctx.fillRect(0, 0, w, h);
				}
				else {
					w *= t._11;
					h *= t._22;
					if(PROFILING && profile) {
						profile.fillRect++;
						Profile.addCommand(`fillrect ${_fill}`);
					}
					_ctx.fillRect(t.tx, t.ty, w, h);
				}
			},
			drawImage: function (tex: Texture, transform: Handle, w: number, h: number, srcRect?: Rect, quad?: Number2[]) {
				var t = toMatrix(transform);
				var img = tex.image;
				if(!img)
					return;
				//if (PerformanceCounter)
				//	PerformanceCounter.drawCount++;			
				var m = tex.margin;
				var sx = 1, sy = 1;
				if(m) {
					sx = w / tex.width;
					sy = h / tex.height;
				}
				if(setTransform(t)) {
					if(PROFILING && profile) {
						profile.drawImage++;
						Profile.addCommand(`drawimage ${tex.name}`);
					}
					if(srcRect) {
						if(m)
							_ctx.drawImage(img, srcRect.left, srcRect.top, srcRect.width, srcRect.height,
								sx * m[0], sy * m[1], sx * (tex.width - m[0] - m[2]), sy * (tex.height - m[1] - m[3]));
						else
							_ctx.drawImage(img, srcRect.left, srcRect.top, srcRect.width, srcRect.height, 0, 0, w, h);
					}
					else {
						if(m)
							_ctx.drawImage(img, sx * m[0], sy * m[1],
								sx * (tex.width - m[0] - m[2]), sy * (tex.height - m[1] - m[3]));
						else
							_ctx.drawImage(img, 0, 0, w, h);
					}
				}
				else {
					var _11 = t._11;
					var _22 = t._22;
					var w2 = w * _11;
					var h2 = h * _22;
					if(PROFILING && profile) {
						profile.drawImage++;
						Profile.addCommand(`drawimage ${tex.name}`);
					}
					if(srcRect) {
						if(m) {
							sx *= _11;
							sy *= _22;
							_ctx.drawImage(img, srcRect.left, srcRect.top, srcRect.width, srcRect.height,
								sx * m[0] + t.tx, sy * m[1] + t.ty, sx * (tex.width - m[0] - m[2]), sy * (tex.height - m[1] - m[3]));
						}
						else
							_ctx.drawImage(img, srcRect.left, srcRect.top, srcRect.width, srcRect.height, t.tx, t.ty, w2, h2);
					}
					else {
						if(m) {
							sx *= _11;
							sy *= _22;
							_ctx.drawImage(img, t.tx + m[0] * sx, t.ty + m[1] * sy
								, sx * (tex.width - m[0] - m[2]), sy * (tex.height - m[1] - m[3]));
						}
						else
							_ctx.drawImage(img, t.tx, t.ty, w2, h2);
					}
				}
			},

			drawImageRepeat: function (tex: Texture, transform: Handle, width: number, height: number, repeat: string) {
				if(tex.empty)
					return;
				var t = toMatrix(transform);
				//var tex = tex.getAloneTexture();
				var pattern = _ctx.createPattern(tex.image, repeat);
				_fill = pattern;
				_ctx.fillStyle = pattern;
				if(PROFILING && profile) {
					profile.drawImage++;
					Profile.addCommand(`drawImageRepeat ${tex.name}`);
				}
				setTransform(t, true);
				_ctx.fillRect(0, 0, width, height);
			},

			drawImageS9: function (texture: Texture, transform: Handle, s9: Number4, width: number, height: number, srcRect?: Rect) {
				if (texture.empty)
					return;
				var img = texture.image;
				if(width <= 0 || height <= 0)
					return;
				var t = toMatrix(transform);
				//if (PerformanceCounter)
				//	PerformanceCounter.drawCount++;
				_transform = t.clone();
				_ctx.setTransform(t._11, t._12, t._21, t._22, t.tx, t.ty);
				var x = srcRect ? srcRect.left : 0;
				var y = srcRect ? srcRect.top : 0;
				var w = srcRect ? srcRect.width : texture.width;
				var h = srcRect ? srcRect.height : texture.height;
				var dh = height - s9[1] - s9[3];
				var dw = width - s9[0] - s9[2];
				var sw = w - s9[0] - s9[2];
				var sh = h - s9[1] - s9[3];
				if(PROFILING && profile) {
					profile.drawImage += 9;
					Profile.addCommand(`drawImageS9 ${texture.name}`);
				}
				var w1 = Math.min(s9[0], width);
				var h1 = Math.min(s9[1], height);
				if(s9[0] > 0) {
					if(s9[1] > 0)
						_ctx.drawImage(img, x, y, w1, h1, 0, 0, w1, h1);
					if(s9[3] > 0 && height > s9[1])
						_ctx.drawImage(img, x, y + h - s9[3], w1, s9[3], 0, height - s9[3], w1, s9[3]);
					if(dh > 0)
						_ctx.drawImage(img, x, y + s9[1], w1, sh, 0, s9[1], w1, dh);
				}
				if(s9[2] > 0 && width > s9[0]) {
					if(s9[1] > 0)
						_ctx.drawImage(img, x + w - s9[2], y, s9[2], h1, width - s9[2], 0, s9[2], h1);
					if(s9[3] > 0 && height > s9[1])
						_ctx.drawImage(img, x + w - s9[2], y + h - s9[3], s9[2], s9[3], width - s9[2], height - s9[3], s9[2], s9[3]);
					if(dh > 0)
						_ctx.drawImage(img, x + w - s9[2], y + s9[1], s9[2], sh, width - s9[2], s9[1], s9[2], dh);
				}
				if(dw > 0 && sw > 0) {
					if(s9[1] > 0)
						_ctx.drawImage(img, x + s9[0], y, sw, h1, s9[0], 0, dw, h1);
					if(s9[3] > 0 && height > s9[1])
						_ctx.drawImage(img, x + s9[0], y + h - s9[3], sw, s9[3], s9[0], height - s9[3], dw, s9[3]);
					if(dh > 0)
						_ctx.drawImage(img, x + s9[0], y + s9[1], sw, sh, s9[0], s9[1], dw, dh);
				}
			},

			setAlphaBlend: function (alpha: number, blendMode: BlendMode) {
				if(_blendMode != blendMode) {
					_blendMode = blendMode;
					_ctx.globalCompositeOperation = CompositeOperation[_blendMode];
					if(PROFILING && profile)
						Profile.addCommand(`setCompositeOperation ${blendMode}`);
				}
				if(_alpha != alpha) {
					_alpha = alpha;
					_ctx.globalAlpha = _alpha;
					if(PROFILING && profile)
						Profile.addCommand(`setAlpha ${_alpha}`);
				}
			},
			drawText: function (content: TextMetric, transform: Handle, x: number, y: number, w: number, h: number, a: AlignMode, stroke?: StrokeStyle) {
				//if (PerformanceCounter)
				//	PerformanceCounter.drawCount++;
				var t = toMatrix(transform);
				if(!setTransform2(t)) {
					x += t.tx;
					y += t.ty;
				}
				if(_font != content.font) {
					_font = content.font;
					_ctx.font = content.font;
					if(PROFILING && profile)
						Profile.addCommand(`setFont ${content.font}`);
				}//RenderContext.setFont(content.font);
				var s = content.lineHeight;
				y += 1;
				//y += s >> 1;
				if(stroke) {
					_ctx.strokeStyle = stroke.color;
					_ctx.lineWidth = stroke.width;
				}
				if((a & AlignMode.VCenter) == AlignMode.VCenter)
					y += (h - (content.lines.length + 0.4) * s) * 0.5;
				else if((a & AlignMode.Bottom) == AlignMode.Bottom)
					y += h - (content.lines.length + 0.4) * s;
				var x0 = x;
				for(var i = 0; i < content.lines.length; i++) {
					var l = content.lines[i];
					if((a & AlignMode.Center) == AlignMode.Center)
						x = (w - l.width) >> 1;
					else if((a & AlignMode.Right) == AlignMode.Right)
						x = w - l.width;
					else
						x = 0;
					if(stroke) {
						_ctx.strokeText(l.text, (x0 + x) | 0, y | 0, w | 0);
						if(PROFILING && profile) {
							profile.drawText++;
							Profile.addCommand(`strokeText ${l.text}`);
						}
					}
					_ctx.fillText(l.text, (x0 + x) | 0, y | 0, w | 0);
					if(PROFILING && profile) {
						profile.drawText++;
						Profile.addCommand(`fillText ${l.text}`);
					}
					y += s;
				}
			},

			pushClipRect: function (bound: Rect) {
				var clip = bound.clone();
				clip.left = Math.max(clip.left, _currClip.left);
				clip.top = Math.max(clip.top, _currClip.top);
				clip.width = Math.max(0, Math.min(clip.right, _currClip.right) - clip.left);
				clip.height = Math.max(0, Math.min(clip.bottom, _currClip.bottom) - clip.top);
				_clips.push(clip);
				_currClip = clip;
				_ctx.save();
				if(_transform)
					_transform = null;
				_ctx.setTransform(1, 0, 0, 1, 0, 0);
				_ctx.beginPath();
				_ctx.rect(clip.left, clip.top, clip.width, clip.height);
				//_ctx.closePath();
				_ctx.clip();
				if(PROFILING && profile)
					Profile.addCommand(`setClip`);
				return clip.width > 0 && clip.height > 0;
			},

			popClipRect: function () {
				_alpha = undefined;
				_fill = undefined;
				_blendMode = undefined;
				_font = undefined;
				_clips.pop();
				_currClip = _clips[_clips.length - 1];
				_ctx.restore();
				if(_transform)
					_transform = null;
				_ctx.setTransform(1, 0, 0, 1, 0, 0);
				if(PROFILING && profile)
					Profile.addCommand(`popclip`);
			},

			endRender: function () {
				//_ctx.restore();
			},

			setFillColor: function (col: string) {
				if(_fill !== col) {
					_ctx.fillStyle = col;
					_fill = col;
					if(PROFILING && profile)
						Profile.addCommand(`setFillColor ${col}`);
				}
			},

			getCanvasContext2D: function (): CanvasRenderingContext2D {
				return _ctx;
			},
			setFillGradient: function (g: GradientFill) {
				var grad = _ctx.createLinearGradient(g.x0 || 0, g.y0 || 0, g.x1 || 0, g.y1 || 0);
				for(var i = 0; i < g.colors.length; i++)
					grad.addColorStop(i / (g.colors.length - 1), g.colors[i]);
				_fill = g;
				_ctx.fillStyle = grad;
				if(PROFILING && profile)
					Profile.addCommand(`setFillGradient`);
			}
		}
		return RC;
	}
}