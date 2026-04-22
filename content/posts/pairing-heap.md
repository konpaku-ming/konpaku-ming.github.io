---
title: "Time of Delete-Min in Pairing Heaps"
date: 2026-03-25
draft: false
type: "posts"
description: "Analysis on the time complexity of pairing heaps"
math: true
categories: ["数据结构", "理论"]
---

{{< ncm id="4968757" >}}

《车轮之国 向日葵的少女》的 OP ，又是一部我估计不会去推的 gal（只能当一辈子云子了）。今天无意在B站刷到一篇介绍螺丝的文章，才知道原来车轮国也是他的作品...

--------------------

去年我做 priority_queue 大作业的时候就是用配对堆写的，但当时对  `delete-min` 的时间复杂度也没深究，当然在 CR 的时候被狠狠拷打了。拷打完之后自己也死活分析不出来 $O(\log n)$，但当时学业繁重加上我也没耐心慢慢看原论文的证明，于是作罢。

今年机缘巧合之下当了 pq 的助教，为了拷打下一届首先自己要知道这个上界怎么分析出来，然而没有找到能给出严谨且详细证明的博客，只好自己翻原论文看，整理后故写此文。

## Pairing Heap
首先我们需要了解一下研究的是什么问题。如图所示，配对堆是一棵满足堆性质的带权多叉树。![](https://notes.sjtu.edu.cn/uploads/upload_3c1e01504b2a783be16c911b12dc217f.jpg)

在后续的证明中，我们更关注的是它使用 **儿子-兄弟表示法** 的形式（见下图）。每个节点的左指针指向它的第一个儿子，右指针指向它的下一个兄弟。![](https://notes.sjtu.edu.cn/uploads/upload_147ce0cb28e5102d0bbcb34976961a65.jpg)



配对堆的合并操作几乎没有维护任何额外的性质，只是简单的比较根的大小，把一个树直接挂在另一个树下。需要注意的是，一个节点的儿子链表是按插入时间排序的，即最右边的节点最早成为父节点的儿子，最左边的节点最近成为父节点的儿子。这里引用 OI Wiki 上的图和代码。![](https://notes.sjtu.edu.cn/uploads/upload_d27ba28bde3aa51e2c51d2a2238bdb55.jpg)

``` cpp
Node* meld(Node* x, Node* y) {
  // 若有一个为空则直接返回另一个
  if (x == nullptr) return y;
  if (y == nullptr) return x;
  if (x->v > y->v) std::swap(x, y);  // swap后x为权值小的堆，y为权值大的堆
  // 将y设为x的儿子
  y->sibling = x->child;
  x->child = y;
  return x;  // 新的根节点为 x
}
```

在 `delete-min` 操作中，我们需要将最小值（也就是根）移除，并将产生的多个子树合并。注意到，由于我们在合并时很偷懒，不能指望这棵树有什么好的性质能减少子树的数量，所以配对堆设计了一套独特的合并子树的顺序与方式。
![](https://notes.sjtu.edu.cn/uploads/upload_5b37f74309884778bf0c9fb12492a153.png)

具体来说，合并子树时需要「两步走」：
1.  把儿子们两两配成一对，用 meld 操作把被配成同一对的两个儿子合并到一起（见下图 1）。若为奇数，最右侧的儿子不配对。
2. 将新产生的堆 **从右往左**（即老的儿子到新的儿子的方向）挨个合并在一起（见下图 2）。

![](https://notes.sjtu.edu.cn/uploads/upload_b9a432a33fe528a85fbe0ac5a0b5efe6.jpg)
![](https://notes.sjtu.edu.cn/uploads/upload_8e524a0803b2a0f9e1e189432e2389e5.jpg)

显然，这样还是进行了 $k$ 次合并（$k$ 为儿子数）。我们期望这种合并方式做了一些“好事”，有利于我们之后的 `delete-min` 。

## 势能分析

这里的证明来源于 [原论文](https://www.cs.cmu.edu/~sleator/papers/pairing-heaps.pdf) ，它将复杂度分析到 `meld` 和 `delete-min` 操作均为均摊 $O(\log⁡ n)$

为了分析均摊复杂度，我们需要定义一个势能函数，并研究 `delete-min` 操作带来的势能变化。

对 **儿子-兄弟表示**下的配对堆（形式为二叉树） 做如下定义：
- 节点 $x$ 的 $size$ $s(x)$ 是 **以该节点作为根**的子树的大小
- 节点 $x$ 的 $rank$ $r(x)$ 等于 $\log s(x)$ （底数为 $2$）
- 势能函数 $\Phi =\sum{r\left( x \right)}$ ，即所有节点的 $rank$ 之和

-----------------------------------------------

首先我们可以说明，`meld` 的时间复杂度是均摊 $O(\log n)$ 的。

**Proof :** 对于两个合计有 $n$ 个节点的配对堆，合并本身花费 $O(1)$ 的时间，同时会带来势能上升。势能最大上升 $\log ⁡n +1$ ：合并过程中，只有两个根的 $rank$ 会增加（见图），它们的子树不受影响。其中，$size$ 较小的根合并后 $rank$ 最多增加 $\log n$ ；$size$ 较大的根合并后下面的节点最多翻一倍，即 $rank$ 最多增加 $1$ 。
![](https://notes.sjtu.edu.cn/uploads/upload_ca7e5f0418b1e9868a0051cebffc43be.jpg)

`insert` 可视为单节点的配对堆与主堆合并，同样也是均摊 $O(\log n)$ 的

----------------------------------------------

之后我们需要说明 `delete-min` 在这种均摊下是 $O(\log n)$ 的。可以先来看看 first-pass 中的一次 link 会对势能造成多大的影响（Figure 9）。
![](https://notes.sjtu.edu.cn/uploads/upload_bee2e41c6a2aea0933746776a9202891.png)

假设 $C$ 子树非空，势能的变化只在于 $r(x)$ 和 $r(y)$ ，而且这个上升值与 $x,y$ 的大小无关（见图中双向箭头）。由图可知势能上升：
$$
r'\left( x \right) +r'\left( y \right) -r''\left( x \right) -r''\left( y \right) 
$$
$$
=\log \left( s\left( a \right) +s\left( b \right) +1 \right) -\log \left( s\left( b \right) +s\left( c \right) +1 \right) 
$$

我们利用一些不等式来给出这个势能上升值的上界。
$$
x,y>0,\ x+y\le 1,\ \log x+\log y\le -2
$$
$-2$ 的上界在 $x=y=1/2$ 时取到，该式可由均值不等式证明。

因此我们推出：
$$
\log \left( s\left( a \right) +s\left( b \right) +1 \right) +\log \left( s\left( c \right) \right) -2\log \left( s\left( a \right) +s\left( b \right) +s\left( c \right) +2 \right) 
$$
$$
=\log \left( \frac{s\left( a \right) +s\left( b \right) +1}{s\left( a \right) +s\left( b \right) +s\left( c \right) +2} \right) +\log \left( \frac{s\left( c \right)}{s\left( a \right) +s\left( b \right) +s\left( c \right) +2} \right) 
$$
$$
\le -2 （利用上面的不等式）
$$

给出该 link 带来的势能上升值的上界：
$$
\left. \begin{array}{r}
	\log \left( s\left( a \right) +s\left( b \right) +1 \right) +\log \left( s\left( c \right) \right) -2\log \left( s\left( a \right) +s\left( b \right) +s\left( c \right) +2 \right) \le -2\\
	\log \left( s\left( c \right) \right) \le \log \left( s\left( b \right) +s\left( c \right) +1 \right)\\
\end{array} \right\} 
$$
$$
\Rightarrow \,\,\Delta \Phi =\log \left( s\left( a \right) +s\left( b \right) +1 \right) -\log \left( s\left( b \right) +s\left( c \right) +1 \right) 
$$
$$
\le 2\log \left( s\left( a \right) +s\left( b \right) +s\left( c \right) +2 \right) -2\log \left( s\left( c \right) \right) -2
$$
$$
\Rightarrow \,\,\Delta \Phi \le 2\log \left( s\left( x \right) \right) -2\log \left( s\left( c \right) \right) -2
$$

注意只有最右侧两个儿子的合并会出现 $C$ 子树为空的情况（对于前面的 link ，$y$ 总是有右兄弟的）。因此对最后一个 link 的上界我们要单独给出。
$$
\Delta \Phi =\log \left( s\left( a \right) +s\left( b \right) +1 \right) -\log \left( s\left( b \right) +1 \right) \le 2\log \left( s\left( a \right) +s\left( b \right) +s\left( c \right) +2 \right) 
$$
$$
\Delta \Phi \le 2\log \left( s\left( x \right) \right) 
$$

现在我们需要计算整个 first-pass 中势能的上升值。设原来的配对堆的根有 $2k$ 个儿子，分别记为 $x_1,x_2,x_3,...,x_{2k-1},x_{2k}$ ，在二叉树表示中，它们形成一条长链（Figure 10）。最后一个 link 发生在 $x_{2k-1}$ 和 $x_{2k}$ 之间。
![](https://notes.sjtu.edu.cn/uploads/upload_26e7ce2cee0a147159b361802becdfc6.png)

对于 $x_{2i-1}$ 和 $x_{2i}$ 之间的 link ，其对应的 $C$ 子树为 $x_{2i+1}$ ，因此：
$$
\Delta \Phi \le \sum_{i=1}^{k-1}{\left( 2\log s\left( x_{2i-1} \right) -2\log s\left( x_{2i+1} \right) -2 \right)}+2\log s\left( x_{2k-1} \right) 
$$
$$
\Delta \Phi \le \sum_{i=1}^{k-1}{\left( 2\log s\left( x_{2i-1} \right) -2\log s\left( x_{2i+1} \right) \right)}+2\log s\left( x_{2k-1} \right) -2\left( k-1 \right) 
$$
$$
\Delta \Phi \le 2\log s\left( x_1 \right) -2\left( k-1 \right) 
$$
$$
\Delta \Phi \le 2\log n-2\left( k-1 \right) 
$$

可以预见，结果中的 $-2\left( k-1 \right)$ 将会抵消掉实际用时中的含 $k$ 项。

-----------------------------------------

接下来我们分析 second-pass 中的势能上升。可以宣称，在 second-pass 中，势能最多上升 $\log \left( n-1 \right)$ 。

可以证明，能构造出一个从 second-pass 前的所有节点到 second-pass 后所有节点的一一映射 $f$ ，满足：$s'\left( x \right) \ge s''\left( f\left( x \right) \right)$ 除了被映射到新根的节点。这在 Fig 10 的 Combining  环节中可以看出。对于 $k$ 个子树建立 $k-1$ 个 link ，映射之后最多只有一个点的 $size$ 会增加，之后递推即可得到。

说明这一点后，我们可以知道 second-pass 中势能最多上升 $\log s''\left( f\left( x \right) \right)$ ，最大也就是 $\log \left( n-1 \right)$

--------------------------------------

那么，在整个 `delete-min` 操作中，实际耗时为 $2k-1$ 次 link，$1$ 的 `find-min` 和 $1$ 的 `delete` ，删除堆顶使得势能下降 $\log n$ ，两次 pass 势能最多上升 $2\log n-2\left( k-1 \right) +\log \left( n-1 \right)$ 。总计耗费：
$$
2k+1-\log n+2\log n-2\left( k-1 \right) +\log \left( n-1 \right) 
$$
$$
\le 2\log n+3
$$

可知 `delete-min` 均摊复杂度为 $O(\log n)$

## 写在最后

其实还是挺感慨的，也感谢这次当助教的机会吧，让我能去硬啃去年看不下去的论文，第一次理清楚这个问题。

感觉到了大二下，我也在变得更佛系。不需要紧张地考虑 GPA ，做事也不会那么功利，为了兴趣和热爱工作，终于有种与生命合一的感觉了。

交大三月的花还是很漂亮的，挂几张两周前拍的图，只可惜当时去蔷薇园花还不盛...

![](https://notes.sjtu.edu.cn/uploads/upload_e02b59600822363151072187cffe20b3.jpg)

（一餐的玉兰，我拍不好全景，盗的二月十三的图...）

![](https://notes.sjtu.edu.cn/uploads/upload_2d720faffa4e659da4a019989d91f819.jpg)

（光体那一带有几株，应该是樱花）

![](https://notes.sjtu.edu.cn/uploads/upload_f4967093f088df47a2f3f67c6fa8d284.jpg)

（长亭旁边的白玉兰，比一餐玉兰开的晚些）