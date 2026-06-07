---
title: "EWC And LwF"
date: 2026-06-07
draft: false
type: "posts"
description: "two approaches in continual learning"
math: true
categories: ["机器学习"]
featureimage: "images/ewc-and-lwf.jpg"
---

{{< ncm id="644688" >}}

（话说最近 wyy 又给一堆曲子上 vip 锁，害的我推歌都不敢放特别热门的😡）

Domo，心累的 Youming desu。周末忙着整理 ML 大作业的工作，发现实验用到的持续学习（Continual Learning）方法其实自己并不是很懂（笑），所以花时间学了一下，这篇文章就作为学习笔记吧。

此文主要涉及持续学习里面两个比较经典的方法：EWC 和 LwF。它们都不是现在最新的方法，但很适合作为入门切口：一个从参数重要性出发，一个从知识蒸馏出发，基本能看出持续学习早期工作的两种典型思路。

## 持续学习

问题背景是这样的：如果我们要训一个模型，当然希望所有数据可以在训练前就完全获取，但是实际情况不一定能满足这个条件。数据可能会分成多个 Task 依次加入训练，并且它们的分布也不一定相同。

持续学习希望模型能像人一样，按顺序不断学习新任务，同时不要把旧任务忘光。形式化一点，模型会依次看到一串数据集：

$$
\mathcal{D}_1,\mathcal{D}_2,\ldots,\mathcal{D}_T
$$

训练第 $t$ 个任务时，通常只能访问当前任务的数据 $\mathcal{D}_t$，过去的数据要么完全拿不到，要么只能保存很少一部分。目标是：学完新任务之后，新任务要会，旧任务也尽量别崩。

这里最核心的问题叫 **灾难性遗忘**（catastrophic forgetting）。因为不同任务间是共享模型参数的，训练新任务时会继续改这些参数；如果某些参数本来对旧任务很关键，现在又被新任务大幅更新，那旧任务性能就可能掉得很厉害。

持续学习的方法大概可以先粗分成三类：

- Replay-based methods：保存或生成一些旧数据，学习新任务时顺便复习。
- Regularization-based methods：不保存旧数据，而是在 loss 里加约束，限制模型不要忘。
- Architecture-based methods：为不同任务分配或扩展不同结构，减少任务之间互相覆盖。

此文主要关注的 EWC 和 LwF 都可以放在 regularization-based methods 里面。二者的共同点是都会在新任务 loss 之外加一个的惩罚项，用以限制遗忘；区别在于：

- EWC 约束 **参数**：旧任务重要的参数不要乱动。
- LwF 约束 **输出**：新模型的输出要像旧模型。

## EWC

### 核心想法

EWC 全称是 Elastic Weight Consolidation。Elastic 有“松紧带”的意思，你可以想象这个方法的核心思想就是在旧参数位置上绑了一根弹簧。参数不是完全不能动，但如果某个参数对旧任务很重要，它离开原位置就要付出更大代价。而每个参数对旧任务的“重要度”，就对应着弹簧的弹性系数，问题在于如何评估一个参数对旧任务是否重要。

我们将这个想法形式化一下：假设模型先学完任务 $A$，得到参数 $\theta_A^*$。现在要继续学习任务 $B$。

如果只优化任务 $B$ 的损失：

$$
\mathcal{L}_B(\theta)
$$

那模型会只顾着适应新任务。EWC 的做法是在新任务 loss 后面加一个正则项：

$$
\mathcal{L}_{EWC}(\theta)=\mathcal{L}_B(\theta)+\frac{\lambda}{2}\sum_i F_i(\theta_i-\theta_{A,i}^*)^2
$$

这里各个符号的含义：

- $\theta_i$：当前模型第 $i$ 个参数。
- $\theta_{A,i}^*$：学完旧任务 $A$ 后，第 $i$ 个参数的值。
- $F_i$：用于衡量第 $i$ 个参数对旧任务的重要程度。
- $\lambda$：超参数。$\lambda$ 大，模型更保守；$\lambda$ 小，模型更愿意适应新任务。

这一项类似于加权的 L2 正则。普通 L2 是所有参数都往 0 拉，EWC 是把每个参数往旧任务最优点 $\theta_A^*$ 拉，而且越重要的参数拉得越紧。

### 衡量参数重要性

关键问题是 $F_i$ 怎么来。EWC 用 Fisher Information Matrix 来估计参数重要性。实际中完整 Fisher 太大，所以通常只用对角线近似：

我们简单介绍一下 Fisher 矩阵是什么样的，对于完整的 Fisher 矩阵，其公式为：

$$
F \approx \mathbb{E}_{(x,y)\sim \mathcal{D}_A} \left[\nabla_\theta \log p_\theta(y | x) \nabla_\theta \log p_\theta(y | x)^T \right]
$$

其中 $\nabla_\theta \log p_\theta(y | x)$ 是一个维度与 $\theta$ 相同的向量，是对数似然对参数的梯度，实际操作中用交叉熵损失来算梯度。

假设有 $n$ 个参数，$\nabla_\theta \log p_\theta(y | x)$ 会得到一个 $n \times 1$ 的向量，右乘其转置将得到一个 $n \times n$ 的矩阵，这就是经验 Fisher 信息矩阵。

可以注意到，如果我们不关心参数间的影响，那就只需要关注这个矩阵对角线上的元素（左上到右下）。它们分别对应向量 $\nabla_\theta \log p_\theta(y | x)$ 中每个元素的平方：

$$
F_i \approx
\mathbb{E}_{(x,y) \sim \mathcal{D}_A}
\left[
\left(
\left.
\frac{\partial}{\partial \theta_i}
\log p_\theta(y|x)
\right|_{\theta=\theta_A^*}
\right)^2
\right]
$$

直觉上，如果某个参数稍微变化一下，旧任务上的 log likelihood 就变化很明显，那它就比较重要。反过来，如果梯度平方期望很小，说明旧任务对这个参数不太敏感，新任务就可以更大胆地改它。

如果 $F_i$ 大，说明这个方向很陡，旧任务的 loss 在这个方向很敏感；如果 $F_i$ 小，说明这个方向比较平，参数对旧任务影响不大。EWC 惩罚的是在陡峭方向上的移动。

### 关于 EWC

当然 EWC 有一些很明显的限制。

对角 Fisher 是很粗的近似。它只知道“每个参数自己重不重要”，但不知道参数之间的组合关系。神经网络里很多时候不是某个单独参数决定一切，而是多个参数一起形成一个功能。

其次，我们说 EWC 是在约束参数，但参数空间和函数空间并不是一一对应的。两个模型参数离得很远，输出函数可能差不多；两个模型参数离得近，输出也不一定就相似。所以从“不要忘记行为”这个目标来看，直接约束参数似乎有一点绕。

## LwF

### 核心想法

LwF 全称是 Learning without Forgetting。相比于 EWC 关心参数有没有离开旧位置，LwF 更关心模型的输出有没有变。

LwF 的流程可以记成这样：

1. 学新任务之前，复制一份旧模型并冻结，作为 teacher。
2. 把新任务数据输入 teacher，得到 `old_logits`。
3. 训练新模型时，同时做两件事：用真实标签学习新任务，得到 `current_logits`，用蒸馏 loss 模仿旧模型的输出。

注意这里有一个很有意思的地方：LwF 并不保存旧数据，而是拿 **新任务数据** 去问旧模型：如果看到这些输入，你当成旧任务来做会怎么判断？


### 蒸馏 loss

简单假设前后两个 Task 都是二分类任务，进行到新任务阶段后，teacher 输出 `old_logits`，student 输出 `current_logits`。它们都是二分类 logits，形如 `[logit_pos, logit_neg]`。

先用温度 $T$ 做 softmax：

$$
q_{old}=\operatorname{softmax}\left(\frac{\mathrm{logits}_{old}}{T}\right),\quad q_{new} = \operatorname{softmax}\left(\frac{\mathrm{logits}_{new}}{T}\right)
$$

然后用 KL 散度来衡量新旧模型输出的差异：

$$
\mathcal{L}_{distill} = T^2 \cdot \mathrm{KL}(q_{old} \Vert q_{new})
$$

这里的温度 $T$ 会让概率分布更平滑。相比 one-hot label，soft label 会保留类别之间的相似性。比如 teacher 觉得一张图 70% 像猫、20% 像狗、10% 像狐狸，这比单纯告诉学生“这是猫”包含更多信息。

而在计算蒸馏 loss 项时乘以 $T^2$ 是为了让不同 temperature 下 distillation loss 的梯度量级更稳定，因为 $T$ 变大使 softmax 更平滑，会导致梯度缩小。

最后总的 loss 为：

$$
\mathcal{L}_{total} = \mathrm{CE}(y, p_{student}) + \alpha \mathcal{L}_{distill}
$$

其中 $\mathrm{CE}(y, p_{student})$ 表示新模型在新任务上的 loss，$\alpha$ 是超参数。

### 关于 LwF

LwF 比 EWC 更像是在约束函数行为，而不是约束参数位置。这点是很自然：持续学习真正想保住的是旧任务性能，也就是模型的输入输出关系，而不是某个参数一定要停在原地。

但 LwF 有一个比较强的隐含假设：新任务数据要能在某种程度上代表旧任务相关的输入空间。否则 teacher 在新数据上的输出，并不能很好反映它在旧任务上的行为。

举个极端例子：旧任务是动物分类，新任务全是医学影像。用医学影像去问旧动物分类器“这像什么动物”，得到的分布可能没什么意义。新模型即使在这些输入上模仿了 teacher，也不代表它真的保住了旧动物分类能力。

另外，LwF 蒸馏的是旧模型的输出，不是旧任务的真实标签。如果旧模型本来就错，或者对某些样本很不确定，新模型也会把这些行为一起学下来。任务越来越多时，误差也可能一层层传下去。
