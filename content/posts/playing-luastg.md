---
title: "Playing LuaSTG..."
date: 2026-01-31
draft: false
type: "posts"
description: "My Luastg Trial"
math: true
---

hello，米娜桑~

鸽的这么多天里，主要是摆烂 + 摆弄一些（在我看来）有趣的东西，其中就包括 LuaSTG 。我第一次听说这玩意应该是因为某部同人游戏（大概率是祈华梦），之后也玩过一些算是个人制作的小 Mod ，不过我当时没有考虑过自己做点 STG ，原因也很简单：太菜了。做 STG 需要懂弹设，懂弹设一般飞机技术不会太差，但是我还困在妖E（好像要等到大一下才通😀）。

大学后时间总归比高中多一点，不过 STG 强度应该是远不如之前的。以前基本每周会打一把，这个时间现在变成了一个月。大一上心血来潮（忘记是不是期中给我心态干崩了）有段时间狂练永N，拿单魔理沙还真打出了第一个 N ，不过后来也没什么热情，直到暑假那会开自动雷混关冲全N（后放弃，星莲船手段极其凶残）。大一上的寒假其实有跟人约着做一个小的单关，然而我当时太鸽了，加上假也不长，最后连文件夹都没建（笑）。最近想着稍微玩一玩吧，还能用 AI 写弹幕代码，今天算是终于做出来一张符卡吧，就写一篇纪念一下。

## Before Reading

{{< ncm id="28234319" >}}

我想以几首歌作为自制弹幕的主题，第一个就是竹之花。

如果不知道剧情的还是很推荐去看看原篇的。我一直很推崇用有限的篇幅触动人的作品，竹之花做到了。

虽然后来听到这首歌多是以二倍速的形式了（难视）。

## First Spell Card

其实之前（ 29 号）为了熟悉一下 Editor Sharp 怎么搭配 AI 食用，已经做过一张符卡了，不过那个纯属 AI 创意。

下面这张符就是符卡「竹ノ花」，我的最初构想是让绿色米弹模拟竹子，从版底向上长，最后在末端开花。最后竹子弹幕消失，花雨散落。

由于 1 月 Github Copilot 的额度被我做 CPU 和搭网站烧完了，只能用一些很捞的模型。竹子的处理一直感觉不太像，最后用两排绿色米弹错位并排，感觉差不多就妥协了。一开始做的竹花太稀疏了，都看不出花的形状，后来想做成团簇的形式，但是弹幕量就有些离谱，而且上避的难度有点小，变成纯姿势了。后来也算是妥协做成这样，是让中心相对密一点，但是又向外有一点延伸，不至于画面太空。

下面是 AI 写的代码，中间调了得有几十次。明天就二月了等我换模型~
```lua
lasttask = task.New(self, function()
    task.MoveTo(0, 160, 60, MOVE_NORMAL)
    
    local rng = Rand()
    local timer = 0

    while true do
        self.x = 20 * sin(timer * 1.0)

        for i = 1, 4 do
            local base_x = -150 + (i - 1) * 100 
            
            task.New(self, function()
                local bamboo_parts = {}     
                local current_flowers = {}  

                local function grow_logic(sx, sy, s_angle, depth, max_j, parts, flowers)
                    local curr_x, curr_y = sx, sy
                    local ang = s_angle
                    
                    for j = 1, max_j do
                        ang = ang + rng:Float(-1.0, 1.0)
                        if ang < 80 then ang = 80 elseif ang > 100 then ang = 100 end
                        
                        local step = 10
                        local next_x = curr_x + step * cos(ang)
                        local next_y = curr_y + step * sin(ang)
                        
                        local b1 = New(_straight, grain_b, COLOR_GREEN, curr_x, curr_y, 0, ang, false, 0, true, true, 0, false, 0, 0, 0, false)
                        local b2 = New(_straight, grain_b, COLOR_GREEN, curr_x + 5*cos(ang), curr_y + 5*sin(ang), 0, ang, false, 0, true, true, 0, false, 0, 0, 0, false)
                        table.insert(parts, b1)
                        table.insert(parts, b2)

                        -- --- 【新增：竹叶生长逻辑】 ---
                        -- 主干每 6 节长叶，侧枝在中间长叶
                        if (depth == 0 and j % 6 == 0 and j < max_j - 5) or (depth > 0 and j == 6) then
                            local leaf_side = (rng:Float(0,1) > 0.5 and 1 or -1)
                            for k = 1, 2 do -- 每次成簇长出 2 片叶子
                                local leaf_ang = ang + leaf_side * rng:Float(40, 70)
                                local leaf = New(_straight, grain_a, COLOR_DEEP_GREEN, curr_x, curr_y, 0, leaf_ang, false, 0, true, true, 0, false, 0, 0, 0, false)
                                table.insert(parts, leaf)
                                leaf_side = leaf_side * -1 -- 左右交错或对称
                            end
                        end

                        if depth == 0 and j == 26 then
                            local side = (rng:Float(0, 1) > 0.5 and 1 or -1)
                            task.New(self, function()
                                grow_logic(curr_x, curr_y, ang + side * 30, depth + 1, 12, parts, flowers)
                            end)
                            ang = ang - side * 8
                        end

                        -- 【高密度红色中心花簇】
                        if j >= (max_j - 1) then
                            local bloom_intensity = 18 + (j - (max_j - 1)) * 4
                            for n = 1, bloom_intensity do 
                                local raw_r = sqrt(rng:Float(0, 1)) * 35
                                local offset_a = rng:Float(0, 360) 
                                local fx = curr_x + (raw_r * 1.2) * cos(offset_a)
                                local fy = curr_y + (raw_r * 0.8) * sin(offset_a)
                                local f_type = (rng:Float(0, 1) > 0.7) and grain_a or ball_small
                                local f_color = (f_type == grain_a) and COLOR_PURPLE or COLOR_RED
                                local flower = New(_straight, f_type, f_color, fx, fy, 0, rng:Float(0, 360), false, 0, true, true, 0, false, 0, 0, 0, false)
                                table.insert(flowers, flower)
                            end
                        end

                        curr_x, curr_y = next_x, next_y
                        task.Wait(4)
                    end
                end

                grow_logic(base_x, -260, 90, 0, 46, bamboo_parts, current_flowers)

                task.Wait(30) 

                task.New(self, function()
                    for k = 1, #bamboo_parts do
                        if IsValid(bamboo_parts[k]) then Del(bamboo_parts[k]) end
                        if k % 30 == 0 then task.Wait(1) end
                    end
                end)

                task.Wait(40) 

                for _, flower in ipairs(current_flowers) do
                    if IsValid(flower) then
                        task.New(flower, function()
                            local weight = rng:Float(0, 1)
                            local gravity = 0.005 + (weight * 0.015)
                            flower.vx, flower.vy = rng:Float(-0.4, 0.4), -rng:Float(0, 0.2) * weight
                            local wind_sense = (1.2 - weight) * rng:Float(0.02, 0.04)
                            local friction = 0.97 + (weight * 0.02)
                            while IsValid(flower) do
                                flower.vy = flower.vy - gravity
                                flower.vx = (flower.vx + wind_sense * sin(timer * 2.5 + rng:Float(0, 360))) * friction
                                if flower.vy < -3.5 then flower.vy = -3.5 end
                                task.Wait(1)
                            end
                        end)
                    end
                end
            end)
        end

        task.Wait(320) 
        timer = timer + 1
    end
end)
```

那个注释里写的什么竹叶，我看上去更像是竹节，也就干脆做成深绿色了。

## Final Scene

直接放B站链接了，[传送门](https://www.bilibili.com/video/BV1DU61BmEy2)。

避弹的做法是找到了灵梦机体的 `.lua` 源码，在里面把灵梦的 `frame()` 函数换掉了。大致逻辑是每个弹幕给一定斥力，还要注意把自机拉回版底中部，不然会很容易飘到角落被封死。 

之后会继续做一些符卡，再看看能不能优化这个避弹逻辑，或许真要做成一个小项目呢...

## Something Unrelated

29 号东方迷宫 3 出了，听说汉化可能这两天能好，后面必须要尝尝咸淡了。

最近睡得好晚（起得也好晚），感觉精神有些萎靡啊，调作息吧调作息。